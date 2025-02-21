declare module '../../core/csv_exporter' {
    export class CSVExporter {
        constructor(buffer_size?: number);
        export_pilot_test_data(duration_minutes?: number): string;
        export_session(session_data: { gaze_data: any[] }): string;
    }
} 