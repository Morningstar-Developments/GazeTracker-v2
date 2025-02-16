import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import type { GazeData } from '../types/gazeData';
import { fetchApi } from '../lib/api';

export default function AnalyticsDashboard() {
  const confidenceChartRef = useRef<SVGSVGElement>(null);
  const headPoseChartRef = useRef<SVGSVGElement>(null);
  const fixationChartRef = useRef<SVGSVGElement>(null);
  const velocityChartRef = useRef<SVGSVGElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ['gaze-data'],
    queryFn: () => fetchApi('api/sessions/current/gaze'),
    refetchInterval: 1000,
  });

  // Confidence Chart
  useEffect(() => {
    if (!gazeData?.length || !confidenceChartRef.current) return;

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(confidenceChartRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([0, gazeData.length])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([height - margin.bottom, margin.top]);

    const line = d3.line<GazeData>()
      .x((d, i) => x(i))
      .y(d => y(d.confidence || 0));

    svg.append('path')
      .datum(gazeData)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5)
      .attr('d', line);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .text('Time');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .text('Confidence');
  }, [gazeData]);

  // Head Pose Chart
  useEffect(() => {
    if (!gazeData?.length || !headPoseChartRef.current) return;

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(headPoseChartRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([0, gazeData.length])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([-45, 45])
      .range([height - margin.bottom, margin.top]);

    const yawLine = d3.line<GazeData>()
      .x((d, i) => x(i))
      .y(d => y(d.HeadYaw || 0));

    const pitchLine = d3.line<GazeData>()
      .x((d, i) => x(i))
      .y(d => y(d.HeadPitch || 0));

    svg.append('path')
      .datum(gazeData)
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-width', 1.5)
      .attr('d', yawLine);

    svg.append('path')
      .datum(gazeData)
      .attr('fill', 'none')
      .attr('stroke', 'blue')
      .attr('stroke-width', 1.5)
      .attr('d', pitchLine);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    const legend = svg.append('g')
      .attr('transform', `translate(${width - 100},${margin.top})`);

    legend.append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', 'red');

    legend.append('text')
      .attr('x', 25)
      .attr('y', 5)
      .text('Yaw');

    legend.append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 20)
      .attr('y2', 20)
      .attr('stroke', 'blue');

    legend.append('text')
      .attr('x', 25)
      .attr('y', 25)
      .text('Pitch');
  }, [gazeData]);

  // Fixation Chart
  useEffect(() => {
    if (!gazeData?.length || !fixationChartRef.current) return;

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(fixationChartRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([0, gazeData.length])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(gazeData, d => d.fixationDuration) || 1000])
      .range([height - margin.bottom, margin.top]);

    const fixationLine = d3.line<GazeData>()
      .x((d, i) => x(i))
      .y(d => y(d.fixationDuration || 0));

    const avgFixationLine = d3.line<GazeData>()
      .x((d, i) => x(i))
      .y(d => y(d.fixationDuration || 0));

    svg.append('path')
      .datum(gazeData)
      .attr('fill', 'none')
      .attr('stroke', 'green')
      .attr('stroke-width', 1.5)
      .attr('d', fixationLine);

    svg.append('path')
      .datum(gazeData)
      .attr('fill', 'none')
      .attr('stroke', 'orange')
      .attr('stroke-dasharray', '5,5')
      .attr('stroke-width', 1.5)
      .attr('d', avgFixationLine);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    const legend = svg.append('g')
      .attr('transform', `translate(${width - 140},${margin.top})`);

    legend.append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', 'green');

    legend.append('text')
      .attr('x', 25)
      .attr('y', 5)
      .text('Current');

    legend.append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 20)
      .attr('y2', 20)
      .attr('stroke', 'orange')
      .attr('stroke-dasharray', '5,5');

    legend.append('text')
      .attr('x', 25)
      .attr('y', 25)
      .text('Average');
  }, [gazeData]);

  // Velocity Chart
  useEffect(() => {
    if (!gazeData?.length || !velocityChartRef.current) return;

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(velocityChartRef.current);
    svg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([0, gazeData.length])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(gazeData, d => d.gazeVelocity) || 100])
      .range([height - margin.bottom, margin.top]);

    const velocityLine = d3.line<GazeData>()
      .x((d, i) => x(i))
      .y(d => y(d.gazeVelocity || 0));

    svg.append('path')
      .datum(gazeData)
      .attr('fill', 'none')
      .attr('stroke', 'purple')
      .attr('stroke-width', 1.5)
      .attr('d', velocityLine);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .text('Time');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .text('Velocity (px/s)');
  }, [gazeData]);

  // Live Metrics
  useEffect(() => {
    if (!gazeData?.length || !metricsRef.current) return;

    const lastData = gazeData[gazeData.length - 1];
    const avgConfidence = d3.mean(gazeData, d => d.confidence) || 0;

    const metricsHtml = `
      <div class="metrics-grid">
        <div class="metric-group">
          <h3>Session Info</h3>
          <div class="metric">
            <label>Session Time:</label>
            <span>${lastData.sessionTimeFormatted}</span>
          </div>
          <div class="metric">
            <label>Current Time:</label>
            <span>${lastData.formattedTime}</span>
          </div>
          <div class="metric">
            <label>Date:</label>
            <span>${lastData.formattedDate}</span>
          </div>
        </div>

        <div class="metric-group">
          <h3>Eye Tracking Quality</h3>
          <div class="metric">
            <label>Current Confidence:</label>
            <span>${((lastData.confidence || 0) * 100).toFixed(2)}%</span>
          </div>
          <div class="metric">
            <label>Avg Confidence:</label>
            <span>${(avgConfidence * 100).toFixed(1)}%</span>
          </div>
          <div class="metric">
            <label>Tracking State:</label>
            <span>${getTrackingState(lastData.state)}</span>
          </div>
        </div>

        <div class="metric-group">
          <h3>Fixation Metrics</h3>
          <div class="metric">
            <label>Current Duration:</label>
            <span>${lastData.fixationDuration?.toFixed(0) || 0}ms</span>
          </div>
          <div class="metric">
            <label>Avg Duration:</label>
            <span>${lastData.avgFixationDuration?.toFixed(0) || 0}ms</span>
          </div>
          <div class="metric">
            <label>Fixations/min:</label>
            <span>${lastData.fixationsPerMinute?.toFixed(1) || 0}</span>
          </div>
        </div>

        <div class="metric-group">
          <h3>Movement Metrics</h3>
          <div class="metric">
            <label>Current Velocity:</label>
            <span>${lastData.gazeVelocity?.toFixed(1) || 0} px/s</span>
          </div>
          <div class="metric">
            <label>Saccade Length:</label>
            <span>${lastData.saccadeLength?.toFixed(1) || 0}px</span>
          </div>
          <div class="metric">
            <label>Avg Saccade:</label>
            <span>${lastData.avgSaccadeLength?.toFixed(1) || 0}px</span>
          </div>
        </div>

        <div class="metric-group">
          <h3>Head Pose</h3>
          <div class="metric">
            <label>Yaw:</label>
            <span>${lastData.HeadYaw?.toFixed(1) || 0}°</span>
          </div>
          <div class="metric">
            <label>Pitch:</label>
            <span>${lastData.HeadPitch?.toFixed(1) || 0}°</span>
          </div>
          <div class="metric">
            <label>Roll:</label>
            <span>${lastData.HeadRoll?.toFixed(1) || 0}°</span>
          </div>
        </div>

        <div class="metric-group">
          <h3>Other Metrics</h3>
          <div class="metric">
            <label>Blink Rate:</label>
            <span>${(lastData.blinkRate || 0).toFixed(1)} blinks/min</span>
          </div>
          <div class="metric">
            <label>Saccades/min:</label>
            <span>${lastData.saccadesPerMinute?.toFixed(1) || 0}</span>
          </div>
          <div class="metric">
            <label>Pupil Diameter:</label>
            <span>${lastData.pupilD?.toFixed(2) || 0}</span>
          </div>
        </div>
      </div>
    `;

    metricsRef.current.innerHTML = metricsHtml;
  }, [gazeData]);

  function getTrackingState(state?: number): string {
    switch (state) {
      case 0: return '✅ Valid';
      case -1: return '❌ Face Lost';
      case 1: return '⚠️ Uncalibrated';
      default: return '❓ Unknown';
    }
  }

  return (
    <div className="analytics-dashboard">
      <h2>Live Analytics</h2>
      <div ref={metricsRef} className="metrics-container" />
      <div className="charts-container">
        <div className="chart">
          <h3>Gaze Confidence</h3>
          <svg ref={confidenceChartRef} width="400" height="200" />
        </div>
        <div className="chart">
          <h3>Head Pose</h3>
          <svg ref={headPoseChartRef} width="400" height="200" />
        </div>
        <div className="chart">
          <h3>Fixation Duration</h3>
          <svg ref={fixationChartRef} width="400" height="200" />
        </div>
        <div className="chart">
          <h3>Gaze Velocity</h3>
          <svg ref={velocityChartRef} width="400" height="200" />
        </div>
      </div>
    </div>
  );
} 