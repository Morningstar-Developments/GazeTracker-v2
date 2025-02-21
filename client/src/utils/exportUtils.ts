import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import type { GazeData } from '../types/gazeData';
import { format } from 'date-fns';
import { HeadingLevel } from 'docx';

interface SessionData {
  participantId: string;
  sessionType: string;
  startTime: string | null;
  endTime: string | null;
  duration: number;
  totalDataPoints: number;
  gazeData: GazeData[];
}

const getFormattedFilename = (data: SessionData, extension: string): string => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const prefix = data.sessionType === 'pilot' ? 'P' : 'L';
  const participantId = data.participantId.padStart(3, '0');
  return `${prefix}${participantId}_${data.sessionType}_${timestamp}${extension}`;
};

const getDataPath = (data: SessionData): string => {
  return `data/${data.sessionType === 'pilot' ? 'pilot' : 'live'}`;
};

export const exportToJSON = async (data: SessionData) => {
  const filename = getFormattedFilename(data, '.json');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAs(blob, filename);
};

export const exportToCSV = async (data: SessionData) => {
  const filename = getFormattedFilename(data, '.csv');
  
  // Create CSV data matching template format
  const csvData = Papa.unparse({
    fields: [
      'timestamp', 'time_24h', 'x', 'y', 'confidence', 'pupilD',
      'docX', 'docY', 'HeadX', 'HeadY', 'HeadZ',
      'HeadYaw', 'HeadPitch', 'HeadRoll'
    ],
    data: data.gazeData.map(point => ({
      timestamp: point.timestamp,
      time_24h: format(new Date(point.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      x: point.x?.toFixed(3),
      y: point.y?.toFixed(3),
      confidence: point.confidence?.toFixed(2),
      pupilD: point.pupilD?.toFixed(1),
      docX: point.x?.toFixed(3),  // Using x as docX
      docY: point.y?.toFixed(3),  // Using y as docY
      HeadX: point.HeadX?.toFixed(1),
      HeadY: point.HeadY?.toFixed(1),
      HeadZ: point.HeadZ?.toFixed(1),
      HeadYaw: point.HeadYaw?.toFixed(1),
      HeadPitch: point.HeadPitch?.toFixed(1),
      HeadRoll: point.HeadRoll?.toFixed(1)
    }))
  });

  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
};

export const exportToXLSX = async (data: SessionData) => {
  const filename = getFormattedFilename(data, '.xlsx');
  
  const wb = XLSX.utils.book_new();
  
  // Session Info Sheet
  const sessionInfo = [
    ['Participant ID', data.participantId],
    ['Session Type', data.sessionType],
    ['Start Time', data.startTime],
    ['End Time', data.endTime],
    ['Duration (ms)', data.duration],
    ['Total Data Points', data.totalDataPoints]
  ];
  const sessionWs = XLSX.utils.aoa_to_sheet(sessionInfo);
  XLSX.utils.book_append_sheet(wb, sessionWs, 'Session Info');

  // Gaze Data Sheet
  const gazeDataArray = data.gazeData.map(point => [
    point.timestamp,
    format(new Date(point.timestamp), 'yyyy-MM-dd HH:mm:ss'),
    point.x?.toFixed(3),
    point.y?.toFixed(3),
    point.confidence?.toFixed(2),
    point.pupilD?.toFixed(1),
    point.docX?.toFixed(3),
    point.docY?.toFixed(3),
    point.HeadX?.toFixed(1),
    point.HeadY?.toFixed(1),
    point.HeadZ?.toFixed(1),
    point.HeadYaw?.toFixed(1),
    point.HeadPitch?.toFixed(1),
    point.HeadRoll?.toFixed(1)
  ]);
  gazeDataArray.unshift([
    'Timestamp', 'Time 24h', 'X', 'Y', 'Confidence', 'PupilD',
    'DocX', 'DocY', 'HeadX', 'HeadY', 'HeadZ',
    'HeadYaw', 'HeadPitch', 'HeadRoll'
  ]);
  const gazeWs = XLSX.utils.aoa_to_sheet(gazeDataArray);
  XLSX.utils.book_append_sheet(wb, gazeWs, 'Gaze Data');

  // Generate blob
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
};

export const exportToDocx = (data: SessionData) => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'Gaze Tracking Session Report',
          heading: HeadingLevel.HEADING_1
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Session Information', heading: HeadingLevel.HEADING_2 }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Participant ID' })] }),
                new TableCell({ children: [new Paragraph({ text: data.participantId })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Session Type' })] }),
                new TableCell({ children: [new Paragraph({ text: data.sessionType })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Start Time' })] }),
                new TableCell({ children: [new Paragraph({ text: data.startTime || 'N/A' })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'End Time' })] }),
                new TableCell({ children: [new Paragraph({ text: data.endTime || 'N/A' })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Duration (ms)' })] }),
                new TableCell({ children: [new Paragraph({ text: data.duration.toString() })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Total Data Points' })] }),
                new TableCell({ children: [new Paragraph({ text: data.totalDataPoints.toString() })] })
              ]
            })
          ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Data Summary', heading: HeadingLevel.HEADING_2 }),
        // Add summary statistics or visualizations here if needed
      ]
    }]
  });

  Packer.toBlob(doc).then(blob => {
    saveAs(blob, `gaze-data-${data.participantId}-${data.sessionType}-${format(new Date(), 'yyyyMMdd-HHmmss')}.docx`);
  });
};

export const exportToMarkdown = (data: SessionData) => {
  const markdown = `# Gaze Tracking Session Report

## Session Information

- **Participant ID:** ${data.participantId}
- **Session Type:** ${data.sessionType}
- **Start Time:** ${data.startTime || 'N/A'}
- **End Time:** ${data.endTime || 'N/A'}
- **Duration:** ${data.duration}ms
- **Total Data Points:** ${data.totalDataPoints}

## Data Summary

\`\`\`json
${JSON.stringify(data.gazeData[0], null, 2)}
\`\`\`

*Note: First data point shown as example. Full dataset contains ${data.totalDataPoints} points.*
`;

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
  saveAs(blob, `gaze-data-${data.participantId}-${data.sessionType}-${format(new Date(), 'yyyyMMdd-HHmmss')}.md`);
};

// Helper functions
function calculateDataSummary(gazeData: GazeData[]) {
  const summary = {
    avgConfidence: 0,
    avgPupilD: 0,
    headMovement: {
      x: { min: 0, max: 0, range: 0 },
      y: { min: 0, max: 0, range: 0 },
      z: { min: 0, max: 0, range: 0 },
      yaw: { min: 0, max: 0, range: 0 },
      pitch: { min: 0, max: 0, range: 0 },
      roll: { min: 0, max: 0, range: 0 }
    }
  };

  if (gazeData.length === 0) return summary;

  // Calculate averages
  const validConfidence = gazeData.filter(point => point.confidence !== undefined);
  const validPupilD = gazeData.filter(point => point.pupilD !== undefined);
  
  summary.avgConfidence = validConfidence.length > 0
    ? validConfidence.reduce((sum, point) => sum + (point.confidence || 0), 0) / validConfidence.length
    : 0;
  
  summary.avgPupilD = validPupilD.length > 0
    ? validPupilD.reduce((sum, point) => sum + (point.pupilD || 0), 0) / validPupilD.length
    : 0;

  // Calculate head movement ranges
  const headX = gazeData.map(point => point.HeadX || 0);
  const headY = gazeData.map(point => point.HeadY || 0);
  const headZ = gazeData.map(point => point.HeadZ || 0);
  const headYaw = gazeData.map(point => point.HeadYaw || 0);
  const headPitch = gazeData.map(point => point.HeadPitch || 0);
  const headRoll = gazeData.map(point => point.HeadRoll || 0);

  summary.headMovement = {
    x: {
      min: Math.min(...headX),
      max: Math.max(...headX),
      range: Math.max(...headX) - Math.min(...headX)
    },
    y: {
      min: Math.min(...headY),
      max: Math.max(...headY),
      range: Math.max(...headY) - Math.min(...headY)
    },
    z: {
      min: Math.min(...headZ),
      max: Math.max(...headZ),
      range: Math.max(...headZ) - Math.min(...headZ)
    },
    yaw: {
      min: Math.min(...headYaw),
      max: Math.max(...headYaw),
      range: Math.max(...headYaw) - Math.min(...headYaw)
    },
    pitch: {
      min: Math.min(...headPitch),
      max: Math.max(...headPitch),
      range: Math.max(...headPitch) - Math.min(...headPitch)
    },
    roll: {
      min: Math.min(...headRoll),
      max: Math.max(...headRoll),
      range: Math.max(...headRoll) - Math.min(...headRoll)
    }
  };

  return summary;
}

function generateDataSummary(gazeData: GazeData[]): Paragraph[] {
  const summary = calculateDataSummary(gazeData);
  
  return [
    new Paragraph({
      children: [
        new TextRun({ text: `Average Confidence: ${summary.avgConfidence.toFixed(2)}`, break: 1 }),
        new TextRun({ text: `Average Pupil Diameter: ${summary.avgPupilD.toFixed(2)}`, break: 1 }),
        new TextRun({ text: 'Head Movement Range:', break: 1 }),
        new TextRun({ text: `  X: ${summary.headMovement.x.range.toFixed(2)} units`, break: 1 }),
        new TextRun({ text: `  Y: ${summary.headMovement.y.range.toFixed(2)} units`, break: 1 }),
        new TextRun({ text: `  Z: ${summary.headMovement.z.range.toFixed(2)} units`, break: 1 })
      ]
    })
  ];
}

function generateSampleDataTable(gazeData: GazeData[]): Paragraph[] {
  const table = new Table({
    rows: [
      // Header row
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Timestamp')] }),
          new TableCell({ children: [new Paragraph('X')] }),
          new TableCell({ children: [new Paragraph('Y')] }),
          new TableCell({ children: [new Paragraph('Confidence')] }),
          new TableCell({ children: [new Paragraph('PupilD')] }),
          new TableCell({ children: [new Paragraph('Head Position (X,Y,Z)')] }),
          new TableCell({ children: [new Paragraph('Head Rotation (Yaw,Pitch,Roll)')] })
        ]
      }),
      // Data rows (first 10 points only)
      ...gazeData.slice(0, 10).map(point => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(format(new Date(point.timestamp), 'HH:mm:ss.SSS'))] }),
          new TableCell({ children: [new Paragraph(point.x.toFixed(3))] }),
          new TableCell({ children: [new Paragraph(point.y.toFixed(3))] }),
          new TableCell({ children: [new Paragraph((point.confidence || 0).toFixed(2))] }),
          new TableCell({ children: [new Paragraph((point.pupilD || 0).toFixed(1))] }),
          new TableCell({ children: [new Paragraph(
            `(${point.HeadX?.toFixed(1) || '0.0'}, ${point.HeadY?.toFixed(1) || '0.0'}, ${point.HeadZ?.toFixed(1) || '0.0'})`
          )] }),
          new TableCell({ children: [new Paragraph(
            `(${point.HeadYaw?.toFixed(1) || '0.0'}, ${point.HeadPitch?.toFixed(1) || '0.0'}, ${point.HeadRoll?.toFixed(1) || '0.0'})`
          )] })
        ]
      }))
    ]
  });

  return [
    new Paragraph({ text: 'Sample Data Points (First 10)', heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ children: [table] })
  ];
} 