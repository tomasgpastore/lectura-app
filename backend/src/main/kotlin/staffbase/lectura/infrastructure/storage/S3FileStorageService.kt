package staffbase.lectura.infrastructure.storage

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.*
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import java.time.Duration

@Service
@Profile("remote")
class AwsS3FileStorageService : FileStorageService {

    private val bucketName = System.getenv("AWS_S3_BUCKET_NAME") 
        ?: throw IllegalStateException("AWS_S3_BUCKET_NAME environment variable is required")

    private val region: Region = Region.of(System.getenv("AWS_REGION") 
        ?: throw IllegalStateException("AWS_REGION environment variable is required"))

    private val credentials = AwsBasicCredentials.create(
        System.getenv("AWS_ACCESS_KEY_ID") 
            ?: throw IllegalStateException("AWS_ACCESS_KEY_ID environment variable is required"),
        System.getenv("AWS_SECRET_KEY")
            ?: throw IllegalStateException("AWS_SECRET_KEY environment variable is required")
    )

    private val s3Client: S3Client = S3Client.builder()
        .region(region)
        .credentialsProvider(StaticCredentialsProvider.create(credentials))
        .build()

    private val presigner: S3Presigner = S3Presigner.builder()
        .region(region)
        .credentialsProvider(StaticCredentialsProvider.create(credentials))
        .build()

    override fun store(file: MultipartFile, fileName: String): Boolean {
        return try {
            val request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .contentType(file.contentType)
                .build()

            s3Client.putObject(request, RequestBody.fromInputStream(file.inputStream, file.size))
            true
        } catch (e: S3Exception) {
            false
        }
    }
    
    override fun storeBytes(bytes: ByteArray, fileName: String, contentType: String): Boolean {
        return try {
            val request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .contentType(contentType)
                .build()

            s3Client.putObject(request, RequestBody.fromBytes(bytes))
            true
        } catch (e: S3Exception) {
            false
        }
    }

    override fun load(fileName: String): ByteArray {
        return try {
            val request = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .build()

            s3Client.getObject(request).use { responseStream ->
                responseStream.readAllBytes()
            }
        } catch (e: S3Exception) {
            throw RuntimeException("Failed to load file: $fileName", e)
        }
    }

    override fun delete(fileName: String): Boolean {
        return try {
            val request = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .build()

            s3Client.deleteObject(request)
            true
        } catch (e: S3Exception) {
            false
        }
    }

    override fun exists(fileName: String): Boolean {
        return try {
            val request = HeadObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .build()
            s3Client.headObject(request)
            true
        } catch (e: NoSuchKeyException) {
            false
        } catch (e: S3Exception) {
            false
        }
    }

    override fun generatePresignedUrl(fileName: String): String {
        return try {
            val getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .build()

            val presignRequest = GetObjectPresignRequest.builder()
                .getObjectRequest(getObjectRequest)
                .signatureDuration(Duration.ofMinutes(10))
                .build()

            presigner.presignGetObject(presignRequest).url().toString()
        } catch (e: S3Exception) {
            throw RuntimeException("Failed to generate presigned URL for file: $fileName", e)
        }
    }
}

@Service
@Profile("local")
class DummyS3FileStorageService : FileStorageService {

    override fun store(file: MultipartFile, fileName: String): Boolean {
        println("[DummyS3] Storing file: $fileName (${file.originalFilename})")
        return true
    }
    
    override fun storeBytes(bytes: ByteArray, fileName: String, contentType: String): Boolean {
        println("[DummyS3] Storing bytes: $fileName (${bytes.size} bytes, $contentType)")
        return true
    }

    override fun load(fileName: String): ByteArray {
        println("[DummyS3] Loading file: $fileName")
        return "Dummy content for $fileName".toByteArray()
    }

    override fun delete(fileName: String): Boolean {
        println("[DummyS3] Deleting file: $fileName")
        return true
    }

    override fun exists(fileName: String): Boolean {
        println("[DummyS3] Checking if file exists: $fileName")
        return true
    }

    override fun generatePresignedUrl(fileName: String): String {
        println("[DummyS3] Generating presigned URL for: $fileName")
        return "https://dummy-s3.fake-bucket.amazonaws.com/$fileName"
    }
}
