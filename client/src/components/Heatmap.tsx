import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GazeData } from "../types/gazeData";
import * as d3 from "d3";
import { hexbin } from 'd3-hexbin';
import { fetchApi } from "../lib/api";

export default function Heatmap() {
  const [isVisible, setIsVisible] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch historical gaze data
  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ["gaze-data"],
    queryFn: () => fetchApi("api/sessions/current/gaze"),
  });

  useEffect(() => {
    if (!svgRef.current || !gazeData || !isVisible) {
      // Clear SVG if heatmap is hidden
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
      }
      return;
    }

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const hexbinGenerator = hexbin<[number, number]>()
      .radius(30)
      .extent([[0, 0], [width, height]]);

    // Compute Fixation Density
    const FIXATION_THRESHOLD = 30; 
    const filteredFixations = (gazeData || []).filter((d, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return Math.sqrt((d.x - prev.x) ** 2 + (d.y - prev.y) ** 2) < FIXATION_THRESHOLD;
    });
    const points = filteredFixations.map((d) => [d.x, d.y] as [number, number]);
    const bins = hexbinGenerator(points);

    const color = d3.scaleSequential(d3.interpolatePlasma)
      .domain([0, d3.max(bins.map(d => d.length)) ?? 0]);

    svg
      .append("g")
      .selectAll("path")
      .data(bins)
      .enter()
      .append("path")
      .attr("d", hexbinGenerator.hexagon())
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .attr("fill", d => color(d.length))
      .attr("stroke", "#222");
  }, [gazeData, isVisible]);

  return (
    <div className="heatmap-container">
      <button
        type="button"
        className="heatmap-toggle"
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? 'Hide Heatmap' : 'Show Heatmap'}
      </button>
      <svg
        ref={svgRef}
        width="800"
        height="600"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          opacity: isVisible ? 0.6 : 0,
          transition: 'opacity 0.3s ease'
        }}
      />
    </div>
  );
} 