declare module '@core/csv_exporter' {
    export class CSVExporter {
        constructor(buffer_size?: number);
        
        generate_test_data(duration_minutes?: number, sampling_rate?: number): Array<{
            timestamp: number;
            x: number;
            y: number;
            confidence: number;
            pupilD: number | null;
            docX: number;
            docY: number;
            HeadX: number;
            HeadY: number;
            HeadZ: number;
            HeadYaw: number;
            HeadPitch: number;
            HeadRoll: number;
        }>;
        
        export_pilot_test_data(duration_minutes?: number): string;
        
        export_session(session_data: {
            gaze_data: Array<{
                timestamp: number;
                x: number;
                y: number;
                confidence?: number;
                pupilD?: number;
                docX?: number;
                docY?: number;
                HeadX?: number;
                HeadY?: number;
                HeadZ?: number;
                HeadYaw?: number;
                HeadPitch?: number;
                HeadRoll?: number;
            }>;
        }): string;
    }
} 