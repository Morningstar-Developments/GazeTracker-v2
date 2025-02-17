import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GazeData } from "../types/gazeData";
import * as d3 from "d3";
import { hexbin } from 'd3-hexbin';
import { fetchApi } from "../lib/api";

export default function Heatmap() {
  const [isVisible, setIsVisible] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ["gaze-data"],
    queryFn: () => fetchApi("api/sessions/current/gaze"),
    refetchInterval: isVisible ? 1000 : false, // Only fetch when visible
  });

  useEffect(() => {
    if (!svgRef.current || !gazeData || !isVisible) {
      if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
      }
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);
    
    svg.selectAll("*").remove();

    const hexbinGenerator = hexbin<[number, number]>()
      .radius(30)
      .extent([[0, 0], [width, height]]);

    // Filter out low confidence points and compute fixations
    const validPoints = gazeData.filter(d => (d.confidence || 0) > 0.3);
    const FIXATION_THRESHOLD = 30;
    const fixations = validPoints.filter((d, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return Math.sqrt(
        Math.pow((d.x - prev.x), 2) + 
        Math.pow((d.y - prev.y), 2)
      ) < FIXATION_THRESHOLD;
    });

    const points = fixations.map(d => [d.x, d.y] as [number, number]);
    const bins = hexbinGenerator(points);

    const colorScale = d3.scaleSequential(d3.interpolateInferno)
      .domain([0, d3.max(bins, d => d.length) || 1]);

    svg.append("g")
      .selectAll("path")
      .data(bins)
      .join("path")
      .attr("d", hexbinGenerator.hexagon())
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .attr("fill", d => colorScale(d.length))
      .attr("stroke", "#222")
      .attr("stroke-opacity", 0.2);

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
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          opacity: isVisible ? 0.6 : 0,
          transition: 'opacity 0.3s ease',
          zIndex: 1000
        }}
      />
    </div>
  );
} 