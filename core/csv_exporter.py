import csv
from typing import Dict, List, Optional
import io
from datetime import datetime
import numpy as np

class CSVExporter:
    def __init__(self):
        self.session_data = None
        self.required_fields = ["timestamp", "x", "y"]
        self.numeric_fields = [
            "x", "y", "confidence", "pupilD", "docX", "docY",
            "HeadX", "HeadY", "HeadZ", "HeadYaw", "HeadPitch", "HeadRoll"
        ]

    def validate_numeric_field(self, value: any, field: str) -> Optional[float]:
        """Validate and convert numeric fields"""
        try:
            if value is None or value == "":
                return None
            val = float(value)
            if not np.isfinite(val):
                return None
            return val
        except (ValueError, TypeError):
            return None

    def validate_timestamp(self, timestamp: any) -> Optional[int]:
        """Validate timestamp field"""
        try:
            ts = int(timestamp)
            # Check if timestamp is within reasonable range (between 2024 and 2025)
            if 1704067200000 <= ts <= 1735689600000:
                return ts
            return None
        except (ValueError, TypeError):
            return None

    def format_24h_time(self, timestamp: int) -> str:
        """Format timestamp to 24-hour time string"""
        try:
            dt = datetime.fromtimestamp(timestamp / 1000)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except:
            return ""

    def validate_data_point(self, data: Dict) -> Optional[Dict]:
        """Validate a single data point"""
        validated = {}
        
        # Validate required fields
        for field in self.required_fields:
            if field not in data:
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

    def export_session(self, session_data: Dict) -> str:
        """Export session data to CSV format"""
        try:
            self.session_data = session_data
            output = io.StringIO()
            writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

            # Write header
            writer.writerow([
                'timestamp', 'time_24h', 'x', 'y', 'confidence', 'pupilD', 
                'docX', 'docY', 'HeadX', 'HeadY', 'HeadZ',
                'HeadYaw', 'HeadPitch', 'HeadRoll'
            ])

            # Validate and write data points
            valid_count = 0
            invalid_count = 0
            
            for data in self.session_data.get("gaze_data", []):
                validated_data = self.validate_data_point(data)
                if validated_data:
                    writer.writerow([
                        validated_data["timestamp"],
                        validated_data["time_24h"],
                        round(validated_data["x"], 3) if validated_data["x"] is not None else "",
                        round(validated_data["y"], 3) if validated_data["y"] is not None else "",
                        round(validated_data["confidence"], 2) if validated_data["confidence"] is not None else "",
                        round(validated_data["pupilD"], 1) if validated_data["pupilD"] is not None else "",
                        round(validated_data["docX"], 3) if validated_data["docX"] is not None else "",
                        round(validated_data["docY"], 3) if validated_data["docY"] is not None else "",
                        round(validated_data["HeadX"], 1) if validated_data["HeadX"] is not None else "",
                        round(validated_data["HeadY"], 1) if validated_data["HeadY"] is not None else "",
                        round(validated_data["HeadZ"], 1) if validated_data["HeadZ"] is not None else "",
                        round(validated_data["HeadYaw"], 1) if validated_data["HeadYaw"] is not None else "",
                        round(validated_data["HeadPitch"], 1) if validated_data["HeadPitch"] is not None else "",
                        round(validated_data["HeadRoll"], 1) if validated_data["HeadRoll"] is not None else ""
                    ])
                    valid_count += 1
                else:
                    invalid_count += 1

            print(f"✅ Exported {valid_count} valid data points")
            if invalid_count > 0:
                print(f"⚠️  Skipped {invalid_count} invalid data points")

            return output.getvalue()
        except Exception as e:
            print(f"❌ CSV Export Error: {e}")
            return ""

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