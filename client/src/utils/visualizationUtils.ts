import * as d3 from 'd3';
import { GazeData } from '../types/gazeData';
import { AnalyticsResult, FixationData, SaccadeData } from './analyticsUtils';
import heatmap from 'heatmap.js';

export interface VisualizationOptions {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    colorScheme?: string[];
    animate?: boolean;
    showLegend?: boolean;
}

export class GazeDataVisualizer {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private width: number;
    private height: number;
    private margin: { top: number; right: number; bottom: number; left: number };
    private contentWidth: number;
    private contentHeight: number;

    constructor(containerId: string, options: VisualizationOptions) {
        this.width = options.width;
        this.height = options.height;
        this.margin = options.margin;
        this.contentWidth = this.width - this.margin.left - this.margin.right;
        this.contentHeight = this.height - this.margin.top - this.margin.bottom;

        // Initialize SVG
        this.svg = d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    public createScanpath(gazeData: GazeData[], fixations: FixationData[], saccades: SaccadeData[]): void {
        // Clear previous visualization
        this.svg.selectAll('*').remove();

        // Create scales
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(gazeData, d => d.x) || 0])
            .range([0, this.contentWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(gazeData, d => d.y) || 0])
            .range([0, this.contentHeight]);

        // Draw saccades (lines between fixations)
        const lineGenerator = d3.line<SaccadeData>()
            .x(d => xScale(d.startX))
            .y(d => yScale(d.startY));

        this.svg.selectAll('.saccade')
            .data(saccades)
            .enter()
            .append('path')
            .attr('class', 'saccade')
            .attr('d', d => {
                return `M${xScale(d.startX)},${yScale(d.startY)}L${xScale(d.endX)},${yScale(d.endY)}`;
            })
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('fill', 'none');

        // Draw fixations (circles)
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
            .attr('stroke-width', 1);
    }

    public createHeatmap(gazeData: GazeData[]): void {
        const heatmapInstance = heatmap.create({
            container: this.svg.node()?.parentElement as HTMLElement,
            radius: 40,
            maxOpacity: 0.6,
            minOpacity: 0,
            blur: 0.75,
        });

        const dataPoints = gazeData.map(point => ({
            x: point.x,
            y: point.y,
            value: 1
        }));

        heatmapInstance.setData({
            max: 10,
            data: dataPoints
        });
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
        const xScale = d3.scaleLinear()
            .domain([0, timeData.length])
            .range([0, this.contentWidth]);

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
            .tickFormat(d => new Date(d).toISOString().substr(11, 8));
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
} 