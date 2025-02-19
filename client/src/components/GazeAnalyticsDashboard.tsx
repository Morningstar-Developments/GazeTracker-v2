import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GazeData } from '../types/gazeData';
import { AnalyticsResult } from '../utils/analyticsUtils';
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
} from '@mui/material';
import { PlayArrow, Pause, Speed, Download, Refresh, Settings } from '@mui/icons-material';
import { debounce } from 'lodash';

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
    gazeData: GazeData[];
    analyticsResult: AnalyticsResult;
    onError?: (error: Error) => void;
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

export const GazeAnalyticsDashboard: React.FC<GazeAnalyticsDashboardProps> = ({
    gazeData,
    analyticsResult,
    onError
}) => {
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

    // Memoize data processing
    const processedData = useMemo(() => {
        try {
            return {
                startTime: gazeData[0]?.timestamp || 0,
                endTime: gazeData[gazeData.length - 1]?.timestamp || 0,
                duration: (gazeData[gazeData.length - 1]?.timestamp || 0) - (gazeData[0]?.timestamp || 0),
                dataPoints: gazeData.length
            };
        } catch (error) {
            console.error('Error processing data:', error);
            return null;
        }
    }, [gazeData]);

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
                onError?.(error as Error);
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
                onError?.(error as Error);
            } finally {
                setIsLoading(false);
            }
        }, 100),
        []
    );

    // Update visualization when data changes
    useEffect(() => {
        if (!visualizerRef.current || !gazeData.length) return;
        setError(null);

        const filteredData = filterDataByTimeRange(gazeData, timeRange);
        debouncedUpdate(filteredData);
    }, [activeTab, timeRange, gazeData, settings]);

    const filterDataByTimeRange = useCallback((data: GazeData[], range: [number, number]): GazeData[] => {
        if (!processedData) return [];

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
            onError?.(error as Error);
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
            const data = {
                gazeData,
                analyticsResult,
                timeRange,
                settings
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
    }, [gazeData, analyticsResult, timeRange, settings]);

    return (
        <ErrorBoundary>
            <Container maxWidth="xl">
                <Box sx={{ width: '100%', typography: 'body1' }}>
                    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h4">
                                Gaze Analytics Dashboard
                            </Typography>
                            <Box>
                                <Tooltip title="Export Data">
                                    <IconButton onClick={handleExport}>
                                        <Download />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Settings">
                                    <IconButton onClick={() => {/* Open settings dialog */}}>
                                        <Settings />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        {error && (
                            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        
                        <Tabs
                            value={activeTab}
                            onChange={(_, newValue) => setActiveTab(newValue)}
                            aria-label="visualization tabs"
                            sx={{ mb: 3 }}
                        >
                            <Tab label="Scanpath" value="scanpath" />
                            <Tab label="Heatmap" value="heatmap" />
                            <Tab label="Temporal Analysis" value="temporal" />
                            <Tab label="Head Movement" value="head-movement" />
                            <Tab label="Pupil Diameter" value="pupil-diameter" />
                            <Tab label="Statistics" value="stats-summary" />
                        </Tabs>

                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                                    <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                                        <IconButton
                                            onClick={() => setIsPlaying(!isPlaying)}
                                            color={isPlaying ? 'secondary' : 'primary'}
                                        >
                                            {isPlaying ? <Pause /> : <PlayArrow />}
                                        </IconButton>
                                    </Tooltip>
                                    
                                    <FormControl sx={{ minWidth: 120 }}>
                                        <InputLabel>Speed</InputLabel>
                                        <Select
                                            value={playbackSpeed}
                                            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                            label="Speed"
                                            startAdornment={<Speed />}
                                        >
                                            <MenuItem value={0.5}>0.5x</MenuItem>
                                            <MenuItem value={1}>1x</MenuItem>
                                            <MenuItem value={2}>2x</MenuItem>
                                            <MenuItem value={4}>4x</MenuItem>
                                        </Select>
                                    </FormControl>

                                    <Box sx={{ flex: 1, mx: 2 }}>
                                        <Slider
                                            value={timeRange}
                                            onChange={(_, value) => setTimeRange(value as [number, number])}
                                            valueLabelDisplay="auto"
                                            valueLabelFormat={value => 
                                                new Date(processedData?.startTime + (processedData?.duration * value / 100) || 0)
                                                    .toISOString()
                                                    .substr(11, 8)
                                            }
                                        />
                                    </Box>
                                </Box>
                            </Grid>

                            <Grid item xs={12}>
                                <Paper
                                    ref={containerRef}
                                    id="visualization-container"
                                    sx={{
                                        width: '100%',
                                        height: 600,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}
                                >
                                    {isLoading && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'rgba(255, 255, 255, 0.8)'
                                            }}
                                        >
                                            <CircularProgress />
                                        </Box>
                                    )}
                                </Paper>
                            </Grid>

                            <Grid item xs={12}>
                                <Paper sx={{ p: 2 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Key Metrics
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="textSecondary">
                                                Average Fixation Duration
                                            </Typography>
                                            <Typography variant="h6">
                                                {analyticsResult.averageFixationDuration.toFixed(2)}ms
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="textSecondary">
                                                Fixations per Minute
                                            </Typography>
                                            <Typography variant="h6">
                                                {analyticsResult.fixationsPerMinute.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={4}>
                                            <Typography variant="body2" color="textSecondary">
                                                Average Saccade Velocity
                                            </Typography>
                                            <Typography variant="h6">
                                                {analyticsResult.averageSaccadeVelocity.toFixed(2)}°/s
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Paper>
                </Box>
            </Container>
        </ErrorBoundary>
    );
}; 