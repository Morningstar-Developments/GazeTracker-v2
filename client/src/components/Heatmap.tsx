import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GazeData } from "@shared/schema";
import * as d3 from "d3";
import { startTracking } from "../lib/gazecloud";  // Ensure real-time tracking

export default function Heatmap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [gazePoints, setGazePoints] = useState<GazeData[]>([]);

  // Fetch existing gaze data
  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ["/api/sessions/current/gaze"],
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const hexbin = d3.hexbin().radius(20).extent([[0, 0], [width, height]]);

    // Combine live gaze data with fetched data
    const allGazeData = [...(gazeData || []), ...gazePoints];
    const points = allGazeData.map((d) => [d.x, d.y]);
    const bins = hexbin(points);

    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, d3.max(bins, (d) => d.length) || 0]);

    svg
      .append("g")
      .selectAll("path")
      .data(bins)
      .enter()
      .append("path")
      .attr("d", hexbin.hexagon())
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("fill", (d) => color(d.length || 0))
      .attr("stroke", "#333");
  }, [gazeData, gazePoints]); // Update when gaze data changes

  // Real-time Gaze Tracking
  useEffect(() => {
    startTracking((data) => {
      setGazePoints((prev) => [...prev, data]); // Append new gaze data
    });
  }, []);

  return <svg ref={svgRef} width="100%" height="100%" />;
}