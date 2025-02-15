import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import type { GazeData } from '../types/gazeData';

export default function AnalyticsDashboard() {
  const confidenceChartRef = useRef<SVGSVGElement>(null);
  const headPoseChartRef = useRef<SVGSVGElement>(null);

  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ['/api/sessions/current/gaze'],
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (!gazeData?.length || !confidenceChartRef.current) return;

    // Confidence Chart
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

  useEffect(() => {
    if (!gazeData?.length || !headPoseChartRef.current) return;

    // Head Pose Chart
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

    // Legend
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

  return (
    <div className="analytics-dashboard">
      <h2>Live Analytics</h2>
      <div className="charts-container">
        <div className="chart">
          <h3>Gaze Confidence</h3>
          <svg ref={confidenceChartRef} width="400" height="200" />
        </div>
        <div className="chart">
          <h3>Head Pose</h3>
          <svg ref={headPoseChartRef} width="400" height="200" />
        </div>
      </div>
    </div>
  );
} 