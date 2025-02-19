import React, { useEffect, useRef, useState } from 'react';
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
} from '@mui/material';

interface GazeAnalyticsDashboardProps {
    gazeData: GazeData[];
    analyticsResult: AnalyticsResult;
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
    colorScheme: ['#ff0000', '#00ff00', '#0000ff']
};

export const GazeAnalyticsDashboard: React.FC<GazeAnalyticsDashboardProps> = ({
    gazeData,
    analyticsResult
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const visualizerRef = useRef<GazeDataVisualizer | null>(null);
    const [activeTab, setActiveTab] = useState<VisualizationType>('scanpath');
    const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    useEffect(() => {
        if (containerRef.current && !visualizerRef.current) {
            visualizerRef.current = new GazeDataVisualizer('visualization-container', visualizationOptions);
        }
    }, []);

    useEffect(() => {
        if (!visualizerRef.current || !gazeData.length) return;

        const filteredData = filterDataByTimeRange(gazeData, timeRange);
        updateVisualization(filteredData);
    }, [activeTab, timeRange, gazeData]);

    const filterDataByTimeRange = (data: GazeData[], range: [number, number]): GazeData[] => {
        const startTime = data[0].timestamp;
        const duration = data[data.length - 1].timestamp - startTime;
        const rangeStart = startTime + (duration * range[0]) / 100;
        const rangeEnd = startTime + (duration * range[1]) / 100;
        
        return data.filter(d => d.timestamp >= rangeStart && d.timestamp <= rangeEnd);
    };

    const updateVisualization = (filteredData: GazeData[]) => {
        if (!visualizerRef.current) return;

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
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: VisualizationType) => {
        setActiveTab(newValue);
    };

    const handleTimeRangeChange = (event: Event, newValue: number | number[]) => {
        setTimeRange(newValue as [number, number]);
    };

    const togglePlayback = () => {
        setIsPlaying(!isPlaying);
    };

    const handleSpeedChange = (event: React.ChangeEvent<{ value: unknown }>) => {
        setPlaybackSpeed(event.target.value as number);
    };

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

    return (
        <Container maxWidth="xl">
            <Box sx={{ width: '100%', typography: 'body1' }}>
                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h4" gutterBottom>
                        Gaze Analytics Dashboard
                    </Typography>
                    
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
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
                            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <Button
                                    variant="contained"
                                    onClick={togglePlayback}
                                    color={isPlaying ? 'secondary' : 'primary'}
                                >
                                    {isPlaying ? 'Pause' : 'Play'}
                                </Button>
                                
                                <FormControl sx={{ minWidth: 120 }}>
                                    <InputLabel>Speed</InputLabel>
                                    <Select
                                        value={playbackSpeed}
                                        onChange={handleSpeedChange}
                                        label="Speed"
                                    >
                                        <MenuItem value={0.5}>0.5x</MenuItem>
                                        <MenuItem value={1}>1x</MenuItem>
                                        <MenuItem value={2}>2x</MenuItem>
                                        <MenuItem value={4}>4x</MenuItem>
                                    </Select>
                                </FormControl>
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
                                    overflow: 'hidden'
                                }}
                            />
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
    );
}; 