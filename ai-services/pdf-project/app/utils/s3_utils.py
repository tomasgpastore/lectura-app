"""
S3 utility functions for handling presigned URLs.
"""

import os
import logging
import boto3
from botocore.exceptions import ClientError
from typing import Optional

logger = logging.getLogger(__name__)


def get_s3_client():
    """Get or create S3 client."""
    # Get AWS credentials from environment
    aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION", "us-east-1")
    
    if not aws_access_key or not aws_secret_key:
        logger.warning("AWS credentials not found in environment. Using default credentials chain.")
        # This will use IAM role, instance profile, or other AWS credential sources
        return boto3.client('s3', region_name=aws_region)
    
    return boto3.client(
        's3',
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=aws_region
    )


def generate_presigned_url(s3_key: str, bucket_name: Optional[str] = None, expiration: int = 3600) -> Optional[str]:
    """
    Generate a presigned URL for an S3 object.
    
    Args:
        s3_key: The S3 key of the object
        bucket_name: The S3 bucket name (from env if not provided)
        expiration: Time in seconds for the URL to remain valid (default 1 hour)
        
    Returns:
        Presigned URL string or None if error
    """
    try:
        if not bucket_name:
            bucket_name = os.getenv("S3_BUCKET_NAME")
            if not bucket_name:
                raise ValueError("S3_BUCKET_NAME not found in environment")
        
        s3_client = get_s3_client()
        
        response = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': s3_key},
            ExpiresIn=expiration
        )
        
        logger.info(f"Generated presigned URL for s3://{bucket_name}/{s3_key}")
        return response
        
    except ClientError as e:
        logger.error(f"Error generating presigned URL: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error generating presigned URL: {e}")
        return None