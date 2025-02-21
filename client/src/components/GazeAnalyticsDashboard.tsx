import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GazeData } from '../types/gazeData';
import { AnalyticsResult, analyzeGazeData } from '../utils/analyticsUtils';
import { GazeDataVisualizer, VisualizationOptions } from '../utils/visualizationUtils';
import {
    Box,
    Container,
    Grid,
    Paper,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    Tabs,
    Tab,
    Slider,
    CircularProgress,
    Alert,
    Tooltip,
    IconButton,
    SelectChangeEvent,
    Stack,
} from '@mui/material';
import { PlayArrow, Pause, Speed, Download, Refresh, Settings } from '@mui/icons-material';
import { debounce } from 'lodash';
import BasicStats from './visualizations/BasicStats';
import GazePath from './visualizations/GazePath';
import PupilDilation from './visualizations/PupilDilation';
import HeadMovement from './visualizations/HeadMovement';

// Error boundary component
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Visualization Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Alert severity="error" sx={{ m: 2 }}>
                    <Typography variant="h6">Visualization Error</Typography>
                    <Typography>{this.state.error?.message}</Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        sx={{ mt: 2 }}
                    >
                        Retry
                    </Button>
                </Alert>
            );
        }
        return this.props.children;
    }
}

interface GazeAnalyticsDashboardProps {
    sessionData?: GazeData[];
    onClose?: () => void;
}

type VisualizationType = 
    | 'scanpath'
    | 'heatmap'
    | 'temporal'
    | 'head-movement'
    | 'pupil-diameter'
    | 'stats-summary';

const visualizationOptions: VisualizationOptions = {
    width: 800,
    height: 600,
    margin: { top: 20, right: 30, bottom: 30, left: 40 },
    animate: true,
    showLegend: true,
    colorScheme: ['#ff0000', '#00ff00', '#0000ff'],
    performanceMode: true
};

const GazeAnalyticsDashboard: React.FC<GazeAnalyticsDashboardProps> = ({ sessionData = [], onClose }) => {
    const [data, setData] = useState<GazeData[]>(sessionData);
    const [analyticsResult, setAnalyticsResult] = useState<AnalyticsResult>(() => analyzeGazeData(sessionData));
    const containerRef = useRef<HTMLDivElement>(null);
    const visualizerRef = useRef<GazeDataVisualizer | null>(null);
    const [activeTab, setActiveTab] = useState<VisualizationType>('scanpath');
    const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState({
        performanceMode: true,
        showTooltips: true,
        smoothAnimation: true
    });

    // Event handlers with proper types
    const handleTabChange = (_: React.SyntheticEvent, newValue: VisualizationType) => {
        setActiveTab(newValue);
    };

    const handleTimeRangeChange = (_: Event, newValue: number | number[]) => {
        setTimeRange(newValue as [number, number]);
    };

    const handleSpeedChange = (event: SelectChangeEvent<number>) => {
        setPlaybackSpeed(Number(event.target.value));
    };

    // Memoize data processing with null checks
    const processedData = useMemo(() => ({
        startTime: data[0]?.timestamp ?? 0,
        endTime: data[data.length - 1]?.timestamp ?? 0,
        duration: data.length > 0 ? data[data.length - 1].timestamp - data[0].timestamp : 0,
        dataPoints: data.length
    }), [data]);

    // Initialize visualizer
    useEffect(() => {
        if (containerRef.current && !visualizerRef.current) {
            try {
                visualizerRef.current = new GazeDataVisualizer(
                    'visualization-container',
                    { ...visualizationOptions, performanceMode: settings.performanceMode }
                );
            } catch (error) {
                console.error('Error initializing visualizer:', error);
                setError('Failed to initialize visualization');
            }
        }

        return () => {
            visualizerRef.current?.cleanup();
        };
    }, [settings.performanceMode]);

    // Debounced update function
    const debouncedUpdate = useCallback(
        debounce((filteredData: GazeData[]) => {
            if (!visualizerRef.current) return;
            setIsLoading(true);
            try {
                updateVisualization(filteredData);
            } catch (error) {
                console.error('Error updating visualization:', error);
                setError('Failed to update visualization');
            } finally {
                setIsLoading(false);
            }
        }, 100),
        []
    );

    // Update visualization when data changes
    useEffect(() => {
        if (!visualizerRef.current || !data.length) return;
        setError(null);

        const filteredData = filterDataByTimeRange(data, timeRange);
        debouncedUpdate(filteredData);
    }, [activeTab, timeRange, data, settings]);

    const filterDataByTimeRange = useCallback((data: GazeData[], range: [number, number]): GazeData[] => {
        const rangeStart = processedData.startTime + (processedData.duration * range[0]) / 100;
        const rangeEnd = processedData.startTime + (processedData.duration * range[1]) / 100;
        
        return data.filter(d => d.timestamp >= rangeStart && d.timestamp <= rangeEnd);
    }, [processedData]);

    const updateVisualization = (filteredData: GazeData[]) => {
        if (!visualizerRef.current) return;

        try {
            switch (activeTab) {
                case 'scanpath':
                    visualizerRef.current.createScanpath(
                        filteredData,
                        analyticsResult.fixations,
                        analyticsResult.saccades
                    );
                    break;
                case 'heatmap':
                    visualizerRef.current.createHeatmap(filteredData);
                    break;
                case 'temporal':
                    visualizerRef.current.createTemporalPlot(analyticsResult);
                    break;
                case 'head-movement':
                    visualizerRef.current.createHeadMovementPlot(filteredData);
                    break;
                case 'pupil-diameter':
                    visualizerRef.current.createPupilDiameterPlot(filteredData);
                    break;
                case 'stats-summary':
                    visualizerRef.current.createStatsSummary(analyticsResult);
                    break;
            }
        } catch (error) {
            console.error('Error in visualization update:', error);
            setError('Failed to update visualization');
        }
    };

    // Playback animation
    useEffect(() => {
        let animationFrame: number;
        
        if (isPlaying) {
            const animate = () => {
                setTimeRange(([start, end]) => {
                    const step = 0.1 * playbackSpeed;
                    if (end >= 100) {
                        setIsPlaying(false);
                        return [0, 100];
                    }
                    return [start + step, end + step];
                });
                animationFrame = requestAnimationFrame(animate);
            };
            animationFrame = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [isPlaying, playbackSpeed]);

    // Export data
    const handleExport = useCallback(() => {
        try {
            const exportData = {
                gazeData: data,
                analyticsResult,
                timeRange,
                settings
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gaze-analysis-${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
            setError('Failed to export data');
        }
    }, [data, analyticsResult, timeRange, settings]);

    useEffect(() => {
        // Update data when sessionData changes
        setData(sessionData);
        setAnalyticsResult(analyzeGazeData(sessionData));
    }, [sessionData]);

    useEffect(() => {
        // Validate data on component mount or data change
        if (data.length > 0) {
            const invalidData = data.some(point => 
                !point.timestamp || 
                point.x === undefined || 
                point.y === undefined
            );

            if (invalidData) {
                setError('Some data points are invalid or missing required fields');
            } else {
                setError(null);
            }
        }
    }, [data]);

    if (data.length === 0) {
        return (
            <Container maxWidth="lg">
                <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>
                        No Data Available
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Please record a session or upload session data to view analytics.
                    </Typography>
                    {onClose && (
                        <Button onClick={onClose} variant="contained" sx={{ mt: 2 }}>
                            Close
                        </Button>
                    )}
                </Paper>
            </Container>
        );
    }

    return (
        <ErrorBoundary>
            <Container maxWidth="lg">
                <Box sx={{ py: 4 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                        <Typography variant="h4" gutterBottom>
                            Gaze Tracking Analytics
                        </Typography>
                        {onClose && (
                            <Button onClick={onClose} variant="outlined">
                                Close
                            </Button>
                        )}
                    </Stack>

                    {error && (
                        <Alert severity="warning" sx={{ mb: 4 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <Box mb={4}>
                        <BasicStats data={data} />
                    </Box>

                    <Box mb={4}>
                        <GazePath data={data} />
                    </Box>

                    <Box mb={4}>
                        <PupilDilation data={data} />
                    </Box>

                    <Box mb={4}>
                        <HeadMovement data={data} />
                    </Box>
                </Box>
            </Container>
        </ErrorBoundary>
    );
};

export default GazeAnalyticsDashboard; 