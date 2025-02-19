import * as d3 from 'd3';
import { GazeData } from '../types/gazeData';
import { AnalyticsResult, FixationData, SaccadeData } from './analyticsUtils';
import Heatmap from 'heatmap.js';
import { debounce } from 'lodash';

// Configure logging
const DEBUG = process.env.NODE_ENV === 'development';
const logger = {
    debug: (...args: any[]) => DEBUG && console.debug('[GazeViz]', ...args),
    info: (...args: any[]) => console.info('[GazeViz]', ...args),
    warn: (...args: any[]) => console.warn('[GazeViz]', ...args),
    error: (...args: any[]) => console.error('[GazeViz]', ...args)
};

export interface VisualizationOptions {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    colorScheme?: string[];
    animate?: boolean;
    showLegend?: boolean;
    performanceMode?: boolean;
}

export interface VisualizationMetrics {
    renderTime: number;
    dataPoints: number;
    memoryUsage: number;
}

export class GazeDataVisualizer {
    private svg!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private width!: number;
    private height!: number;
    private margin!: { top: number; right: number; bottom: number; left: number };
    private contentWidth!: number;
    private contentHeight!: number;
    private options: VisualizationOptions;
    private metrics: VisualizationMetrics;
    private resizeObserver!: ResizeObserver;
    private tooltipDiv!: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
    private currentVisualization: string = '';

    constructor(containerId: string, options: VisualizationOptions) {
        this.options = options;
        this.metrics = {
            renderTime: 0,
            dataPoints: 0,
            memoryUsage: 0
        };

        try {
            this.initializeVisualization(containerId);
            this.setupResizeHandler(containerId);
            this.createTooltip();
            logger.info('Visualization initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize visualization:', error);
            throw new Error('Visualization initialization failed');
        }
    }

    private initializeVisualization(containerId: string): void {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id '${containerId}' not found`);
        }

        this.width = this.options.width;
        this.height = this.options.height;
        this.margin = this.options.margin;
        this.contentWidth = this.width - this.margin.left - this.margin.right;
        this.contentHeight = this.height - this.margin.top - this.margin.bottom;

        // Initialize SVG with error boundary
        try {
            const svgContainer = d3.select(`#${containerId}`)
                .append('svg')
                .attr('width', this.width)
                .attr('height', this.height);

            this.svg = svgContainer
                .append('g')
                .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        } catch (error) {
            logger.error('SVG initialization failed:', error);
            throw error;
        }
    }

    private setupResizeHandler(containerId: string): void {
        const debouncedResize = debounce(() => {
            this.handleResize(containerId);
        }, 250);

        this.resizeObserver = new ResizeObserver(debouncedResize);
        const container = document.getElementById(containerId);
        if (container) {
            this.resizeObserver.observe(container);
        }
    }

    private handleResize(containerId: string): void {
        const container = document.getElementById(containerId);
        if (!container) return;

        const bounds = container.getBoundingClientRect();
        this.width = bounds.width;
        this.height = bounds.height;
        this.contentWidth = this.width - this.margin.left - this.margin.right;
        this.contentHeight = this.height - this.margin.top - this.margin.bottom;

        this.svg
            .attr('width', this.width)
            .attr('height', this.height);

        // Trigger re-render with current data
        this.updateCurrentVisualization();
    }

    private createTooltip(): void {
        this.tooltipDiv = d3.select('body')
            .append('div')
            .attr('class', 'gaze-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px');
    }

    private validateData<T>(data: T[]): boolean {
        if (!Array.isArray(data) || data.length === 0) {
            logger.warn('Invalid or empty data provided');
            return false;
        }
        return true;
    }

    private startPerformanceMetrics(): void {
        this.metrics.renderTime = performance.now();
        // Chrome-only memory API not available in standard Performance interface
        this.metrics.memoryUsage = (window.performance as any)?.memory?.usedJSHeapSize || 0;
    }

    private endPerformanceMetrics(dataPoints: number): void {
        this.metrics.renderTime = performance.now() - this.metrics.renderTime;
        this.metrics.dataPoints = dataPoints;
        this.metrics.memoryUsage = (window.performance as any)?.memory?.usedJSHeapSize || 0;

        logger.debug('Performance Metrics:', {
            renderTime: `${this.metrics.renderTime.toFixed(2)}ms`,
            dataPoints: this.metrics.dataPoints,
            memoryUsage: `${(this.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
        });
    }

    private optimizeDataForPerformance<T>(data: T[]): T[] {
        if (!this.options.performanceMode) return data;

        const threshold = 1000; // Maximum points to render in performance mode
        if (data.length <= threshold) return data;

        // Sample data points
        const samplingRate = Math.ceil(data.length / threshold);
        return data.filter((_, index) => index % samplingRate === 0);
    }

    public createScanpath(gazeData: GazeData[], fixations: FixationData[], saccades: SaccadeData[]): void {
        try {
            this.startPerformanceMetrics();
            if (!this.validateData(gazeData)) return;

            // Clear and prepare visualization
            this.svg.selectAll('*').remove();

            // Optimize data if needed
            const optimizedGazeData = this.optimizeDataForPerformance(gazeData);
            const optimizedFixations = this.optimizeDataForPerformance(fixations);
            const optimizedSaccades = this.optimizeDataForPerformance(saccades);

            // Create scales with error handling
            const xScale = this.createScale(optimizedGazeData, 'x');
            const yScale = this.createScale(optimizedGazeData, 'y');

            // Draw visualization elements
            this.drawSaccades(optimizedSaccades, xScale, yScale);
            this.drawFixations(optimizedFixations, xScale, yScale);
            this.addAxes(xScale, yScale);
            
            if (this.options.showLegend) {
                this.addLegend();
            }

            this.endPerformanceMetrics(gazeData.length);
        } catch (error) {
            logger.error('Error creating scanpath visualization:', error);
            this.showError('Failed to create scanpath visualization');
        }
    }

    private createScale(data: any[], field: string): d3.ScaleLinear<number, number> {
        try {
            const extent = d3.extent(data, d => d[field]) as [number, number];
            return d3.scaleLinear()
                .domain(extent)
                .range(field === 'x' ? [0, this.contentWidth] : [this.contentHeight, 0]);
        } catch (error) {
            logger.error(`Error creating scale for field ${field}:`, error);
            throw error;
        }
    }

    private drawSaccades(saccades: SaccadeData[], xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>): void {
        const line = d3.line<SaccadeData>()
            .x(d => xScale(d.startX))
            .y(d => yScale(d.startY));

        this.svg.selectAll('.saccade')
            .data(saccades)
            .enter()
            .append('path')
            .attr('class', 'saccade')
            .attr('d', d => `M${xScale(d.startX)},${yScale(d.startY)}L${xScale(d.endX)},${yScale(d.endY)}`)
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('fill', 'none')
            .on('mouseover', (event, d) => this.showTooltip(event, this.formatSaccadeData(d)))
            .on('mouseout', () => this.hideTooltip());
    }

    private drawFixations(fixations: FixationData[], xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>): void {
        const radiusScale = d3.scaleLinear()
            .domain([0, d3.max(fixations, d => d.duration) || 0])
            .range([5, 20]);

        this.svg.selectAll('.fixation')
            .data(fixations)
            .enter()
            .append('circle')
            .attr('class', 'fixation')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', d => radiusScale(d.duration))
            .attr('fill', 'rgba(255, 0, 0, 0.5)')
            .attr('stroke', '#ff0000')
            .attr('stroke-width', 1)
            .on('mouseover', (event, d) => this.showTooltip(event, this.formatFixationData(d)))
            .on('mouseout', () => this.hideTooltip());
    }

    private showTooltip(event: any, content: string): void {
        this.tooltipDiv
            .html(content)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .transition()
            .duration(200)
            .style('opacity', 0.9);
    }

    private hideTooltip(): void {
        this.tooltipDiv
            .transition()
            .duration(200)
            .style('opacity', 0);
    }

    private formatFixationData(fixation: FixationData): string {
        return `
            <div class="tooltip-content">
                <strong>Fixation</strong><br>
                Duration: ${fixation.duration.toFixed(2)}ms<br>
                Position: (${fixation.x.toFixed(1)}, ${fixation.y.toFixed(1)})<br>
                Time: ${new Date(fixation.startTime).toISOString().substr(11, 8)}
            </div>
        `;
    }

    private formatSaccadeData(saccade: SaccadeData): string {
        return `
            <div class="tooltip-content">
                <strong>Saccade</strong><br>
                Length: ${saccade.length.toFixed(2)}px<br>
                Velocity: ${saccade.velocity.toFixed(2)}°/s<br>
                Duration: ${saccade.duration.toFixed(2)}ms
            </div>
        `;
    }

    private addAxes(xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>): void {
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        this.svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${this.contentHeight})`)
            .call(xAxis);

        this.svg.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);
    }

    private addLegend(): void {
        const legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${this.contentWidth - 100}, 20)`);

        legend.append('circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 6)
            .attr('fill', 'rgba(255, 0, 0, 0.5)');

        legend.append('text')
            .attr('x', 15)
            .attr('y', 4)
            .text('Fixation');

        legend.append('line')
            .attr('x1', 0)
            .attr('y1', 20)
            .attr('x2', 20)
            .attr('y2', 20)
            .attr('stroke', '#999')
            .attr('stroke-width', 1);

        legend.append('text')
            .attr('x', 25)
            .attr('y', 24)
            .text('Saccade');
    }

    private showError(message: string): void {
        this.svg.selectAll('*').remove();
        
        this.svg.append('text')
            .attr('class', 'error-message')
            .attr('x', this.contentWidth / 2)
            .attr('y', this.contentHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', 'red')
            .text(message);
    }

    public cleanup(): void {
        try {
            this.resizeObserver?.disconnect();
            this.tooltipDiv?.remove();
            this.svg.selectAll('*').remove();
            logger.info('Visualization cleanup completed');
        } catch (error) {
            logger.error('Error during cleanup:', error);
        }
    }

    public createHeatmap(gazeData: GazeData[]): void {
        try {
            this.startPerformanceMetrics();
            if (!this.validateData(gazeData)) return;

            // Clear previous visualization
            this.svg.selectAll('*').remove();

            const container = this.svg.node()?.parentElement?.parentElement;
            if (!container) {
                throw new Error('Could not find container element');
            }

            // Initialize heatmap
            const heatmapInstance = new Heatmap({
                container: container as HTMLElement,
                radius: 40,
                maxOpacity: 0.6,
                minOpacity: 0,
                blur: 0.85
            });

            // Prepare data
            const points = gazeData.map(d => ({
                x: d.x,
                y: d.y,
                value: 1
            }));

            heatmapInstance.setData({
                max: 1,
                data: points
            });

            this.endPerformanceMetrics(gazeData.length);
            this.currentVisualization = 'heatmap';
        } catch (error) {
            logger.error('Error creating heatmap visualization:', error);
            this.showError('Failed to create heatmap visualization');
        }
    }

    public createTemporalPlot(analyticsResult: AnalyticsResult): void {
        // Clear previous visualization
        this.svg.selectAll('*').remove();

        const timeData = analyticsResult.fixations.map((fixation, index) => ({
            index,
            duration: fixation.duration,
            timestamp: fixation.startTime
        }));

        // Create scales
        const xScale = this.createTemporalScale(timeData);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(timeData, d => d.duration) || 0])
            .range([this.contentHeight, 0]);

        // Create axes
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        this.svg.append('g')
            .attr('transform', `translate(0,${this.contentHeight})`)
            .call(xAxis);

        this.svg.append('g')
            .call(yAxis);

        // Create line
        const line = d3.line<typeof timeData[0]>()
            .x(d => xScale(d.index))
            .y(d => yScale(d.duration));

        this.svg.append('path')
            .datum(timeData)
            .attr('class', 'temporal-line')
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 2)
            .attr('d', line);
    }

    private createTemporalScale(data: any[]): d3.ScaleTime<number, number> {
        const extent = d3.extent(data, d => {
            const timestamp = d.timestamp;
            return typeof timestamp === 'number' ? new Date(timestamp) : null;
        });
        return d3.scaleTime()
            .domain(extent as [Date, Date])
            .range([0, this.contentWidth]);
    }

    public createHeadMovementPlot(gazeData: GazeData[]): void {
        // Clear previous visualization
        this.svg.selectAll('*').remove();

        // Create scales for 3D visualization
        const xScale = d3.scaleLinear()
            .domain([
                d3.min(gazeData, d => d.HeadX) || 0,
                d3.max(gazeData, d => d.HeadX) || 0
            ])
            .range([0, this.contentWidth]);

        const yScale = d3.scaleLinear()
            .domain([
                d3.min(gazeData, d => d.HeadY) || 0,
                d3.max(gazeData, d => d.HeadY) || 0
            ])
            .range([this.contentHeight, 0]);

        const zScale = d3.scaleLinear()
            .domain([
                d3.min(gazeData, d => d.HeadZ) || 0,
                d3.max(gazeData, d => d.HeadZ) || 0
            ])
            .range([2, 10]); // Use point size to represent Z

        // Draw head position points
        this.svg.selectAll('.head-point')
            .data(gazeData)
            .enter()
            .append('circle')
            .attr('class', 'head-point')
            .attr('cx', d => xScale(d.HeadX || 0))
            .attr('cy', d => yScale(d.HeadY || 0))
            .attr('r', d => zScale(d.HeadZ || 0))
            .attr('fill', 'rgba(0, 128, 255, 0.5)')
            .attr('stroke', '#0080ff')
            .attr('stroke-width', 1);

        // Add axes
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        this.svg.append('g')
            .attr('transform', `translate(0,${this.contentHeight})`)
            .call(xAxis);

        this.svg.append('g')
            .call(yAxis);
    }

    public createPupilDiameterPlot(gazeData: GazeData[]): void {
        // Clear previous visualization
        this.svg.selectAll('*').remove();

        const timeScale = d3.scaleLinear()
            .domain([
                d3.min(gazeData, d => d.timestamp) || 0,
                d3.max(gazeData, d => d.timestamp) || 0
            ])
            .range([0, this.contentWidth]);

        const pupilScale = d3.scaleLinear()
            .domain([
                d3.min(gazeData, d => d.pupilD) || 0,
                d3.max(gazeData, d => d.pupilD) || 0
            ])
            .range([this.contentHeight, 0]);

        // Create line
        const line = d3.line<GazeData>()
            .x(d => timeScale(d.timestamp))
            .y(d => pupilScale(d.pupilD || 0));

        this.svg.append('path')
            .datum(gazeData)
            .attr('class', 'pupil-line')
            .attr('fill', 'none')
            .attr('stroke', 'purple')
            .attr('stroke-width', 2)
            .attr('d', line);

        // Add axes
        const xAxis = d3.axisBottom(timeScale)
            .tickFormat((d: d3.NumberValue) => new Date(d.valueOf()).toISOString().substr(11, 8));
        const yAxis = d3.axisLeft(pupilScale);

        this.svg.append('g')
            .attr('transform', `translate(0,${this.contentHeight})`)
            .call(xAxis);

        this.svg.append('g')
            .call(yAxis);
    }

    public createStatsSummary(analyticsResult: AnalyticsResult): void {
        // Clear previous visualization
        this.svg.selectAll('*').remove();

        const stats = [
            { label: 'Avg Fixation Duration', value: analyticsResult.averageFixationDuration },
            { label: 'Fixations/min', value: analyticsResult.fixationsPerMinute },
            { label: 'Avg Saccade Length', value: analyticsResult.averageSaccadeLength },
            { label: 'Avg Saccade Velocity', value: analyticsResult.averageSaccadeVelocity },
            { label: 'Avg Head Distance', value: analyticsResult.averageHeadDistance },
            { label: 'Avg Pupil Diameter', value: analyticsResult.averagePupilDiameter }
        ];

        const barScale = d3.scaleLinear()
            .domain([0, d3.max(stats, d => d.value) || 0])
            .range([0, this.contentWidth]);

        const barHeight = this.contentHeight / stats.length;

        const bars = this.svg.selectAll('.stat-bar')
            .data(stats)
            .enter()
            .append('g')
            .attr('class', 'stat-bar')
            .attr('transform', (d, i) => `translate(0,${i * barHeight})`);

        bars.append('rect')
            .attr('width', d => barScale(d.value))
            .attr('height', barHeight * 0.8)
            .attr('fill', 'steelblue');

        bars.append('text')
            .attr('x', 5)
            .attr('y', barHeight * 0.5)
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .text(d => `${d.label}: ${d.value.toFixed(2)}`);
    }

    private updateCurrentVisualization(): void {
        switch (this.currentVisualization) {
            case 'scanpath':
                // Re-render current scanpath
                break;
            case 'heatmap':
                // Re-render current heatmap
                break;
            case 'temporal':
                // Re-render current temporal plot
                break;
            default:
                logger.warn('No current visualization to update');
        }
    }
} 