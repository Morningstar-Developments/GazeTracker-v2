import csv
from typing import Dict, List, Optional, Tuple
import io
from datetime import datetime
import logging
import psutil
import time
from pathlib import Path
import sys
import random
from math import sin, cos

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('gaze_tracker.log')
    ]
)
logger = logging.getLogger(__name__)

class CSVExporter:
    def __init__(self, buffer_size: int = 1000):
        """Initialize CSV Exporter with configurable buffer size
        
        Args:
            buffer_size (int): Number of data points to buffer before writing to disk
        """
        self.session_data = None
        self.required_fields = ["timestamp", "x", "y"]
        self.numeric_fields = [
            "x", "y", "confidence", "pupilD", "docX", "docY",
            "HeadX", "HeadY", "HeadZ", "HeadYaw", "HeadPitch", "HeadRoll"
        ]
        self.buffer_size = buffer_size
        self.data_buffer = []
        self.performance_stats = {
            'total_points': 0,
            'valid_points': 0,
            'invalid_points': 0,
            'processing_time': 0,
            'memory_usage': 0
        }
        logger.info(f"Initialized CSVExporter with buffer size: {buffer_size}")

    def generate_test_data(self, duration_minutes: int = 5, sampling_rate: int = 60) -> List[Dict]:
        """Generate realistic test data for pilot mode
        
        Args:
            duration_minutes (int): Duration of test data in minutes
            sampling_rate (int): Number of samples per second
            
        Returns:
            List[Dict]: List of generated data points
        """
        logger.info(f"Generating {duration_minutes} minutes of test data at {sampling_rate}Hz")
        
        total_points = duration_minutes * 60 * sampling_rate
        start_time = int(time.time() * 1000)  # Current time in milliseconds
        interval = 1000 // sampling_rate  # Interval between points in milliseconds
        
        test_data = []
        
        # Parameters for smooth random movement
        x_center, y_center = 500, 500  # Center of screen
        x_amplitude, y_amplitude = 200, 150  # Movement range
        movement_period = 5.0  # Seconds for one complete oscillation
        
        # Head movement parameters
        head_center = {"x": 0, "y": -10, "z": 45}  # Typical head position
        head_range = {"x": 3, "y": 3, "z": 5}  # Movement range
        head_angle_range = 30  # Maximum rotation angle
        
        for i in range(total_points):
            timestamp = start_time + (i * interval)
            time_factor = i / (sampling_rate * movement_period)
            
            # Generate smooth random movement patterns
            x = x_center + x_amplitude * sin(time_factor) * (0.8 + 0.2 * random.random())
            y = y_center + y_amplitude * cos(time_factor * 1.3) * (0.8 + 0.2 * random.random())
            
            # Add small random variations
            x += random.gauss(0, 5)
            y += random.gauss(0, 5)
            
            # Generate realistic head movement
            head_x = head_center["x"] + head_range["x"] * sin(time_factor * 0.7)
            head_y = head_center["y"] + head_range["y"] * cos(time_factor * 0.5)
            head_z = head_center["z"] + head_range["z"] * sin(time_factor * 0.3)
            
            # Generate head rotation angles
            head_yaw = head_angle_range * sin(time_factor * 0.4) * 0.5
            head_pitch = head_angle_range * cos(time_factor * 0.6) * 0.3
            head_roll = head_angle_range * sin(time_factor * 0.8) * 0.2
            
            # Occasionally introduce missing or invalid data (5% chance)
            if random.random() < 0.05:
                confidence = random.uniform(0, 0.5)  # Low confidence
                pupil_d = None  # Missing pupil data
            else:
                confidence = random.uniform(0.85, 1.0)  # Normal confidence
                pupil_d = random.uniform(3, 6)  # Normal pupil diameter range
            
            data_point = {
                "timestamp": timestamp,
                "x": x,
                "y": y,
                "confidence": confidence,
                "pupilD": pupil_d,
                "docX": x,  # Using same as x
                "docY": y,  # Using same as y
                "HeadX": head_x,
                "HeadY": head_y,
                "HeadZ": head_z,
                "HeadYaw": head_yaw,
                "HeadPitch": head_pitch,
                "HeadRoll": head_roll
            }
            
            test_data.append(data_point)
            
            # Occasionally simulate blinks (2% chance)
            if random.random() < 0.02:
                # Add 3-5 points of blink data
                blink_duration = random.randint(3, 5)
                for j in range(blink_duration):
                    blink_timestamp = timestamp + (j * interval)
                    blink_point = {
                        "timestamp": blink_timestamp,
                        "x": x + random.gauss(0, 10),
                        "y": y + random.gauss(0, 10),
                        "confidence": random.uniform(0, 0.3),
                        "pupilD": random.uniform(2, 2.5),
                        "docX": x + random.gauss(0, 10),
                        "docY": y + random.gauss(0, 10),
                        "HeadX": head_x,
                        "HeadY": head_y,
                        "HeadZ": head_z,
                        "HeadYaw": head_yaw,
                        "HeadPitch": head_pitch,
                        "HeadRoll": head_roll
                    }
                    test_data.append(blink_point)
                    i += 1  # Skip ahead to maintain total duration
        
        logger.info(f"Generated {len(test_data)} test data points")
        return test_data

    def export_pilot_test_data(self, duration_minutes: int = 5) -> str:
        """Export generated pilot test data
        
        Args:
            duration_minutes (int): Duration of test data in minutes
            
        Returns:
            str: CSV string containing the test data
        """
        try:
            test_data = self.generate_test_data(duration_minutes)
            return self.export_session({"gaze_data": test_data})
        except Exception as e:
            logger.error(f"Error generating pilot test data: {str(e)}")
            return ""

    def _check_system_resources(self) -> Tuple[float, float]:
        """Monitor system resource usage
        
        Returns:
            Tuple[float, float]: CPU usage percentage, memory usage percentage
        """
        try:
            cpu_percent = psutil.cpu_percent()
            memory_percent = psutil.Process().memory_percent()
            if cpu_percent > 80 or memory_percent > 80:
                logger.warning(f"High resource usage - CPU: {cpu_percent}%, Memory: {memory_percent}%")
            return cpu_percent, memory_percent
        except Exception as e:
            logger.error(f"Error monitoring system resources: {str(e)}")
            return 0.0, 0.0

    def validate_numeric_field(self, value: any, field: str) -> Optional[float]:
        """Validate and convert numeric fields with detailed error logging"""
        try:
            if value is None or value == "":
                logger.debug(f"Empty value for field {field}")
                return None
            val = float(value)
            if not isinstance(val, (int, float)) or not -float('inf') < val < float('inf'):
                logger.warning(f"Non-finite value detected in field {field}: {val}")
                return None
            
            # Field-specific validation
            if field in ['confidence']:
                if not 0 <= val <= 1:
                    logger.warning(f"Confidence value out of range [0,1]: {val}")
                    return None
            elif field in ['pupilD']:
                if not 2 <= val <= 8:  # typical pupil diameter range in mm
                    logger.warning(f"Pupil diameter outside normal range: {val}mm")
                    return None
            
            return val
        except (ValueError, TypeError) as e:
            logger.error(f"Error validating {field}: {str(e)}, value: {value}")
            return None

    def validate_timestamp(self, timestamp: any) -> Optional[int]:
        """Validate timestamp field with comprehensive checks"""
        try:
            ts = int(timestamp)
            current_time = int(time.time() * 1000)
            
            # Check if timestamp is within reasonable range (between 2024 and 2025)
            if not (1704067200000 <= ts <= 1735689600000):
                logger.warning(f"Timestamp outside valid range: {ts}")
                return None
                
            # Check if timestamp is not in the future
            if ts > current_time + 1000:  # Allow 1 second future tolerance
                logger.warning(f"Future timestamp detected: {ts}")
                return None
                
            # Check for timestamp sequence
            if hasattr(self, 'last_timestamp'):
                if ts < self.last_timestamp:
                    logger.warning(f"Out of sequence timestamp: {ts} < {self.last_timestamp}")
                elif ts - self.last_timestamp > 1000:  # Gap larger than 1 second
                    logger.warning(f"Large timestamp gap detected: {ts - self.last_timestamp}ms")
            
            self.last_timestamp = ts
            return ts
        except (ValueError, TypeError) as e:
            logger.error(f"Error validating timestamp: {str(e)}, value: {timestamp}")
            return None

    def format_24h_time(self, timestamp: int) -> str:
        """Format timestamp to 24-hour time string with error handling"""
        try:
            dt = datetime.fromtimestamp(timestamp / 1000)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            logger.error(f"Error formatting timestamp {timestamp}: {str(e)}")
            return ""

    def validate_data_point(self, data: Dict) -> Optional[Dict]:
        """Validate a single data point with comprehensive checks"""
        try:
            validated = {}
            
            # Validate required fields
            for field in self.required_fields:
                if field not in data:
                    logger.warning(f"Missing required field: {field}")
                    return None
                    
            # Validate timestamp
            timestamp = self.validate_timestamp(data.get("timestamp"))
            if timestamp is None:
                return None
            validated["timestamp"] = timestamp
            validated["time_24h"] = self.format_24h_time(timestamp)
            
            # Validate numeric fields
            for field in self.numeric_fields:
                value = self.validate_numeric_field(data.get(field), field)
                validated[field] = value
                
            return validated
        except Exception as e:
            logger.error(f"Error validating data point: {str(e)}, data: {data}")
            return None

    def _flush_buffer(self, writer: csv.writer) -> None:
        """Flush the data buffer to disk with exact template format"""
        try:
            for validated_data in self.data_buffer:
                # Format timestamp and time_24h
                timestamp = validated_data["timestamp"]
                time_24h = datetime.fromtimestamp(timestamp / 1000).strftime("%Y-%m-%d %H:%M:%S")
                
                writer.writerow([
                    timestamp,                                                         # timestamp
                    time_24h,                                                         # time_24h
                    round(validated_data["x"], 3) if validated_data["x"] is not None else "",  # x
                    round(validated_data["y"], 3) if validated_data["y"] is not None else "",  # y
                    round(validated_data["confidence"], 2) if validated_data["confidence"] is not None else "",  # confidence
                    round(validated_data["pupilD"], 1) if validated_data["pupilD"] is not None else "",  # pupilD
                    round(validated_data["docX"], 3) if validated_data["docX"] is not None else "",  # docX
                    round(validated_data["docY"], 3) if validated_data["docY"] is not None else "",  # docY
                    round(validated_data["HeadX"], 1) if validated_data["HeadX"] is not None else "",  # HeadX
                    round(validated_data["HeadY"], 1) if validated_data["HeadY"] is not None else "",  # HeadY
                    round(validated_data["HeadZ"], 1) if validated_data["HeadZ"] is not None else "",  # HeadZ
                    round(validated_data["HeadYaw"], 1) if validated_data["HeadYaw"] is not None else "",  # HeadYaw
                    round(validated_data["HeadPitch"], 1) if validated_data["HeadPitch"] is not None else "",  # HeadPitch
                    round(validated_data["HeadRoll"], 1) if validated_data["HeadRoll"] is not None else ""   # HeadRoll
                ])
            self.data_buffer = []
        except Exception as e:
            logger.error(f"Error flushing buffer: {str(e)}")
            raise

    def export_session(self, session_data: Dict) -> str:
        """Export session data to CSV format with performance monitoring"""
        start_time = time.time()
        try:
            self.session_data = session_data
            output = io.StringIO()
            writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

            # Write header exactly matching template format
            writer.writerow([
                'timestamp', 'time_24h', 'x', 'y', 'confidence', 'pupilD', 
                'docX', 'docY', 'HeadX', 'HeadY', 'HeadZ',
                'HeadYaw', 'HeadPitch', 'HeadRoll'
            ])

            # Reset performance stats
            self.performance_stats = {
                'total_points': 0,
                'valid_points': 0,
                'invalid_points': 0,
                'processing_time': 0,
                'memory_usage': 0
            }
            
            for data in self.session_data.get("gaze_data", []):
                self.performance_stats['total_points'] += 1
                
                # Monitor system resources periodically
                if self.performance_stats['total_points'] % 100 == 0:
                    _, memory_usage = self._check_system_resources()
                    self.performance_stats['memory_usage'] = memory_usage

                validated_data = self.validate_data_point(data)
                if validated_data:
                    self.data_buffer.append(validated_data)
                    self.performance_stats['valid_points'] += 1
                    
                    # Flush buffer when full
                    if len(self.data_buffer) >= self.buffer_size:
                        self._flush_buffer(writer)
                else:
                    self.performance_stats['invalid_points'] += 1

            # Flush any remaining data
            if self.data_buffer:
                self._flush_buffer(writer)

            # Calculate and log performance metrics
            self.performance_stats['processing_time'] = time.time() - start_time
            self._log_performance_metrics()

            return output.getvalue()
        except Exception as e:
            logger.error(f"Error exporting session: {str(e)}")
            return ""

    def _log_performance_metrics(self) -> None:
        """Log detailed performance metrics"""
        stats = self.performance_stats
        logger.info("Export Performance Metrics:")
        logger.info(f"Total points processed: {stats['total_points']}")
        logger.info(f"Valid points: {stats['valid_points']} ({(stats['valid_points']/stats['total_points']*100):.1f}%)")
        logger.info(f"Invalid points: {stats['invalid_points']} ({(stats['invalid_points']/stats['total_points']*100):.1f}%)")
        logger.info(f"Processing time: {stats['processing_time']:.2f} seconds")
        logger.info(f"Processing rate: {stats['total_points']/stats['processing_time']:.1f} points/second")
        logger.info(f"Memory usage: {stats['memory_usage']:.1f}%")

        if stats['invalid_points'] > 0:
            logger.warning(f"High invalid data rate: {stats['invalid_points']} points")
            
        if stats['processing_time'] > 0 and stats['total_points']/stats['processing_time'] < 100:
            logger.warning("Low processing rate detected - consider optimizing buffer size")

    def validate_gaze_data(self, data: Dict) -> bool:
        """Validate gaze data point"""
        required_fields = ["timestamp", "x", "y"]
        return all(field in data and data[field] is not None for field in required_fields)

    def format_timestamp(self, timestamp: float) -> int:
        """Format timestamp to integer milliseconds"""
        try:
            return int(timestamp)
        except:
            return int(datetime.now().timestamp() * 1000)