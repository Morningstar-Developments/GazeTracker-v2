import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GazeData } from "../types/gazeData";
import * as d3 from "d3";
import * as d3Hexbin from 'd3-hexbin';
import { startTracking } from "../lib/gazecloud";

export default function Heatmap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [gazePoints, setGazePoints] = useState<GazeData[]>([]);

  // Fetch historical gaze data
  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ["/api/sessions/current/gaze"],
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const hexbin = d3Hexbin.hexbin<[number, number]>()
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
    const bins = hexbin(points);

    const color = d3.scaleSequential(d3.interpolatePlasma)
      .domain([0, d3.max(bins, d => d.length) ?? 0]);

    svg
      .append("g")
      .selectAll("path")
      .data(bins)
      .enter()
      .append("path")
      .attr("d", hexbin.hexagon())
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .attr("fill", d => color(d.length))
      .attr("stroke", "#222");
  }, [gazeData]);

  return <svg ref={svgRef} width="100%" height="100%" />;
}