package staffbase.lectura.infrastructure.storage

import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

interface FileStorageService {
    fun store(file: MultipartFile, fileName: String): Boolean
    fun storeBytes(bytes: ByteArray, fileName: String, contentType: String = "application/octet-stream"): Boolean
    fun load(fileName: String): ByteArray
    fun delete(fileName: String): Boolean
    fun exists(fileName: String): Boolean
    fun generatePresignedUrl(fileName: String): String
}
