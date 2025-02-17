import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import type { GazeData } from '../types/gazeData';

interface SessionData {
  sessionInfo: {
    startTime: number | null;
    endTime: number;
    duration: number;
    totalDataPoints: number;
  };
  gazeData: GazeData[];
}

export const exportToJSON = (data: SessionData): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  saveAs(blob, `gaze-tracking-session-${new Date().toISOString()}.json`);
};

export const exportToCSV = (data: SessionData): void => {
  // Flatten gaze data for CSV format
  const flattenedData = data.gazeData.map(point => ({
    timestamp: point.timestamp,
    x: point.x,
    y: point.y,
    docX: point.docX,
    docY: point.docY,
    confidence: point.confidence,
    pupilD: point.pupilD,
    HeadX: point.HeadX,
    HeadY: point.HeadY,
    HeadZ: point.HeadZ,
    HeadYaw: point.HeadYaw,
    HeadPitch: point.HeadPitch,
    HeadRoll: point.HeadRoll
  }));

  const csv = Papa.unparse(flattenedData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `gaze-tracking-session-${new Date().toISOString()}.csv`);
};

export const exportToXLSX = (data: SessionData): void => {
  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();

  // Session Info Sheet
  const sessionInfoData = [
    ['Session Information'],
    ['Start Time', new Date(data.sessionInfo.startTime || 0).toISOString()],
    ['End Time', new Date(data.sessionInfo.endTime).toISOString()],
    ['Duration (ms)', data.sessionInfo.duration],
    ['Total Data Points', data.sessionInfo.totalDataPoints]
  ];
  const sessionWS = XLSX.utils.aoa_to_sheet(sessionInfoData);

  // Gaze Data Sheet
  const gazeDataWS = XLSX.utils.json_to_sheet(data.gazeData);

  // Add sheets to workbook
  XLSX.utils.book_append_sheet(wb, sessionWS, 'Session Info');
  XLSX.utils.book_append_sheet(wb, gazeDataWS, 'Gaze Data');

  // Generate and save file
  XLSX.writeFile(wb, `gaze-tracking-session-${new Date().toISOString()}.xlsx`);
};

export const exportToDocx = async (data: SessionData): Promise<void> => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Gaze Tracking Session Report',
          heading: 'Title'
        }),
        new Paragraph({
          text: `Generated on ${new Date().toLocaleString()}`,
          style: 'Subtitle'
        }),
        new Paragraph({ text: '' }), // Spacing

        // Session Information
        new Paragraph({
          text: 'Session Information',
          heading: 'Heading1'
        }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Start Time')] }),
                new TableCell({ 
                  children: [new Paragraph(new Date(data.sessionInfo.startTime || 0).toLocaleString())]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('End Time')] }),
                new TableCell({ 
                  children: [new Paragraph(new Date(data.sessionInfo.endTime).toLocaleString())]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Duration')] }),
                new TableCell({ 
                  children: [new Paragraph(`${(data.sessionInfo.duration / 1000).toFixed(2)} seconds`)]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Total Data Points')] }),
                new TableCell({ 
                  children: [new Paragraph(data.sessionInfo.totalDataPoints.toString())]
                })
              ]
            })
          ]
        }),
        new Paragraph({ text: '' }), // Spacing

        // Data Summary
        new Paragraph({
          text: 'Data Summary',
          heading: 'Heading1'
        }),
        ...generateDataSummary(data.gazeData),

        // Sample Data Points
        new Paragraph({
          text: 'Sample Data Points (First 10)',
          heading: 'Heading1'
        }),
        ...generateSampleDataTable(data.gazeData.slice(0, 10))
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `gaze-tracking-session-${new Date().toISOString()}.docx`);
};

export const exportToMarkdown = (data: SessionData): void => {
  let md = `# Gaze Tracking Session Report\n`;
  md += `Generated on ${new Date().toLocaleString()}\n\n`;

  // Session Information
  md += `## Session Information\n`;
  md += `- Start Time: ${new Date(data.sessionInfo.startTime || 0).toLocaleString()}\n`;
  md += `- End Time: ${new Date(data.sessionInfo.endTime).toLocaleString()}\n`;
  md += `- Duration: ${(data.sessionInfo.duration / 1000).toFixed(2)} seconds\n`;
  md += `- Total Data Points: ${data.sessionInfo.totalDataPoints}\n\n`;

  // Data Summary
  md += `## Data Summary\n`;
  const summary = calculateDataSummary(data.gazeData);
  md += `- Average Confidence: ${summary.avgConfidence.toFixed(2)}\n`;
  md += `- Average Pupil Diameter: ${summary.avgPupilD.toFixed(2)}\n`;
  md += `- Head Movement Range:\n`;
  md += `  - X: ${summary.headRange.x.toFixed(2)} units\n`;
  md += `  - Y: ${summary.headRange.y.toFixed(2)} units\n`;
  md += `  - Z: ${summary.headRange.z.toFixed(2)} units\n\n`;

  // Sample Data
  md += `## Sample Data Points (First 5)\n`;
  md += `| Timestamp | X | Y | Confidence | Head Position |\n`;
  md += `|-----------|---|---|------------|---------------|\n`;
  data.gazeData.slice(0, 5).forEach(point => {
    md += `| ${new Date(point.timestamp).toLocaleTimeString()} | ${point.x.toFixed(2)} | ${point.y.toFixed(2)} | ${(point.confidence || 0).toFixed(2)} | (${point.HeadX?.toFixed(2) || 0}, ${point.HeadY?.toFixed(2) || 0}, ${point.HeadZ?.toFixed(2) || 0}) |\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  saveAs(blob, `gaze-tracking-session-${new Date().toISOString()}.md`);
};

// Helper functions
function calculateDataSummary(gazeData: GazeData[]) {
  const summary = {
    avgConfidence: 0,
    avgPupilD: 0,
    headRange: {
      x: 0,
      y: 0,
      z: 0
    }
  };

  if (gazeData.length === 0) return summary;

  // Calculate averages
  const confidenceSum = gazeData.reduce((sum, point) => sum + (point.confidence || 0), 0);
  const pupilDSum = gazeData.reduce((sum, point) => sum + (point.pupilD || 0), 0);

  // Calculate head movement ranges
  const headX = gazeData.map(point => point.HeadX || 0);
  const headY = gazeData.map(point => point.HeadY || 0);
  const headZ = gazeData.map(point => point.HeadZ || 0);

  summary.avgConfidence = confidenceSum / gazeData.length;
  summary.avgPupilD = pupilDSum / gazeData.length;
  summary.headRange = {
    x: Math.max(...headX) - Math.min(...headX),
    y: Math.max(...headY) - Math.min(...headY),
    z: Math.max(...headZ) - Math.min(...headZ)
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
        new TextRun({ text: `  X: ${summary.headRange.x.toFixed(2)} units`, break: 1 }),
        new TextRun({ text: `  Y: ${summary.headRange.y.toFixed(2)} units`, break: 1 }),
        new TextRun({ text: `  Z: ${summary.headRange.z.toFixed(2)} units`, break: 1 })
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
          new TableCell({ children: [new Paragraph('Head Position')] })
        ]
      }),
      // Data rows
      ...gazeData.map(point => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(new Date(point.timestamp).toLocaleTimeString())] }),
          new TableCell({ children: [new Paragraph(point.x.toFixed(2))] }),
          new TableCell({ children: [new Paragraph(point.y.toFixed(2))] }),
          new TableCell({ children: [new Paragraph((point.confidence || 0).toFixed(2))] }),
          new TableCell({ children: [new Paragraph(
            `(${point.HeadX?.toFixed(2) || 0}, ${point.HeadY?.toFixed(2) || 0}, ${point.HeadZ?.toFixed(2) || 0})`
          )] })
        ]
      }))
    ]
  });

  return [new Paragraph({ children: [table] })];
} 