package staffbase.lectura.slide

import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import staffbase.lectura.course.CourseService
import staffbase.lectura.infrastructure.storage.FileStorageService
import staffbase.lectura.dao.SlideDAO
import staffbase.lectura.dto.slide.PatchSlideDTO
import staffbase.lectura.ai.EmbeddingProcessingService
import java.util.UUID
import org.apache.pdfbox.pdmodel.PDDocument
import org.bson.types.ObjectId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.springframework.data.redis.core.StringRedisTemplate
import java.util.concurrent.TimeUnit


@Service
class SlideService(
    val fileStorageService: FileStorageService,
    val courseServices: CourseService,
    val slideDAO: SlideDAO,
    val embeddingProcessingService: EmbeddingProcessingService,
    val redisTemplate: StringRedisTemplate,
){

    fun getAllSlidesForCourse(userId : String, courseId : String) : List<Slide>{
        val course = courseServices.getCourseById(userId, courseId) ?: return emptyList()

        return course.slideId.mapNotNull { slideId -> slideDAO.getById(slideId) }
    }

    fun getSlideById(userId : String, courseId : String, slideId: String): Slide? {
        val course = courseServices.getCourseById(userId, courseId) ?: return null

         return if (course.slideId.contains(slideId)) {
             slideDAO.getById(slideId)
        } else { null }
    }

    fun addSlideForCourse(userId: String, courseId: String, file: MultipartFile): Boolean{
        // Check if course exists
        val course = courseServices.getCourseById(userId, courseId) ?: return false

        val newSlideId = UUID.randomUUID().toString()
        val extension = file.originalFilename?.substringAfterLast('.', "bin")
        val storageSlideId = "courses/$courseId/slides/$newSlideId.$extension"

        val pageCount = file.inputStream.use { input -> PDDocument.load(input).use { document -> document.numberOfPages } }

        if(!fileStorageService.store(file, storageSlideId))  { return false }

        // Create Slide object
        val newSlide = Slide (
            id = newSlideId,
            originalFileName = file.originalFilename ?: "Unnamed",
            contentType = file.contentType ?: "application/octet-stream",
            fileSize = file.size,
            storageFileName = storageSlideId,
            courseId = courseId,
            pageCount = pageCount,
        )

        // If file object was not added to DB then delete file from storage
        if(!slideDAO.add(newSlide)){
            fileStorageService.delete(storageSlideId)
            return false
        }

        // New update course object with new slideId list
        val updatedCourse = course.copy(slideId = course.slideId + newSlideId)

        // If course object doesn't update, remove slide object from DB and file from fileStorage
        if (!courseServices.updateCourse(courseId, updatedCourse)) {
            slideDAO.delete(newSlideId)
            fileStorageService.delete(storageSlideId)
            return false
        }

        // Process embeddings asynchronously in a background thread
        val processId = UUID.randomUUID().toString()
        val lockKey = "embedding_process:$userId:$courseId:$processId"
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Set the lock with a TTL of 5 minutes (in case the process hangs)
                redisTemplate.opsForValue().set(lockKey, "processing:$newSlideId", 5, TimeUnit.MINUTES)
                println("Started embedding processing for slide $newSlideId with lock $lockKey")
                
                val success = embeddingProcessingService.processSlideEmbeddings(courseId, newSlideId, storageSlideId)
                if (!success) {
                    println("Failed to process embeddings for slide $newSlideId in course $courseId")
                    // Note: We don't rollback here since the slide is already uploaded
                    // The embeddings can be processed later or manually triggered
                }
                
                println("Completed embedding processing for slide $newSlideId")
            } catch (e: Exception) {
                println("Error processing embeddings for slide $newSlideId: ${e.message}")
            } finally {
                // Always remove the lock when done
                redisTemplate.delete(lockKey)
                println("Removed lock $lockKey for slide $newSlideId")
            }
        }

        return true
    }
    
    fun deleteSlideById(userId: String, courseId : String, slideId: String): Boolean {
        // Check if course exists and if user has it
        val course = courseServices.getCourseById(userId, courseId) ?: return false
        val slide = slideDAO.getById(slideId) ?: return false
        // Check if course has slideId
        if (!course.slideId.contains(slideId)) { return false }

        // Update course object
        val updatedCourse = course.copy(slideId = course.slideId.filter {it != slideId})
        if(!courseServices.updateCourse(courseId, updatedCourse)) { return false }

        if(!slideDAO.delete(slideId)) { 
            // Restore course if slide deletion fails
            courseServices.updateCourse(courseId, course)
            return false 
        }

        // Call microservice to delete embeddings
        if (!embeddingProcessingService.deleteSlideEmbeddings(courseId, slideId, slide.storageFileName)) {
            // Restore slide and course if microservice call fails
            slideDAO.add(slide)
            courseServices.updateCourse(courseId, course)
            return false
        }

        if(!fileStorageService.delete(slide.storageFileName)) {
            // Restore everything if file deletion fails
            slideDAO.add(slide)
            courseServices.updateCourse(courseId, course)
            return false
        }
        return true
    }


    fun updateSlide(userId : String, courseId: String, slideId: String, patch: PatchSlideDTO): Boolean {
        // Check that course exists and user has access
        val course = courseServices.getCourseById(userId, courseId) ?: return false
        // Check that slide exists
        val slide = slideDAO.getById(slideId) ?: return false

        val updatedSlide = slide.copy(originalFileName = patch.originalFileName ?: slide.originalFileName)

        return slideDAO.update(slideId, updatedSlide)
    }

    fun searchSlidesForUser(userId : String, courseId: String, query: String): List<Slide> {
        val course = courseServices.getCourseById(userId, courseId) ?: return emptyList()
        val courseSlides = getAllSlidesForCourse(userId, courseId)

        return courseSlides.filter {
            it.originalFileName.contains(query, ignoreCase = true)
        }
    }

    /*
    fun getSlideSummary(userId: String, courseId: String, slideId: String): String? {
        val course = courseServices.getCourseById(userId, courseId) ?: return null
        if (slideId !in course.slideId) return null

        val slide = slideDAO.getById(slideId) ?: return null

        return slide.summary
    }

     */

    fun getPresignedSlideUrl(userId: String, courseId: String, slideId: String): String? {
        val slide = getSlideById(userId, courseId, slideId) ?: return null
        return fileStorageService.generatePresignedUrl(slide.storageFileName)
    }

}