declare module 'heatmap.js' {
    interface HeatmapConfiguration {
        container: HTMLElement;
        radius?: number;
        maxOpacity?: number;
        minOpacity?: number;
        blur?: number;
        gradient?: { [key: string]: string };
    }

    interface DataPoint {
        x: number;
        y: number;
        value?: number;
    }

    export default class Heatmap {
        constructor(config: HeatmapConfiguration);
        setData(data: { max: number; data: DataPoint[] }): void;
        addData(dataPoint: DataPoint): void;
        removeData(): void;
        repaint(): void;
        getDataURL(): string;
        getValueAt(point: { x: number; y: number }): number;
    }
} 