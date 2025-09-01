package staffbase.lectura.slide

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import staffbase.lectura.auth.AuthenticationService
import staffbase.lectura.dto.slide.PatchSlideDTO
import staffbase.lectura.subscription.SubscriptionLimitService
import staffbase.lectura.exception.SubscriptionLimitException
import kotlinx.coroutines.runBlocking

@RestController
@RequestMapping("/courses/{courseId}/slides")
class SlideController(
    val slideService: SlideService,
    val authenticationService: AuthenticationService,
    val subscriptionLimitService: SubscriptionLimitService
) {

    @GetMapping
    fun getAllSlidesForCourse(
        @PathVariable courseId: String
    ): ResponseEntity<List<Slide>> {
        val userId = authenticationService.requireCurrentUserId()
        val slides = slideService.getAllSlidesForCourse(userId, courseId)
        return ResponseEntity.ok(slides)
    }

    @GetMapping("/{slideId}")
    fun getSlideById(
        @PathVariable courseId: String,
        @PathVariable slideId: String
    ): ResponseEntity<Slide> {
        val userId = authenticationService.requireCurrentUserId()
        val slide = slideService.getSlideById(userId, courseId, slideId)
        return if (slide != null) ResponseEntity.ok(slide) else ResponseEntity.notFound().build()
    }

    @PostMapping
    fun addSlideForCourse(
        @PathVariable courseId: String,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Void> = runBlocking {
        val userId = authenticationService.requireCurrentUserId()
        
        // Check subscription limit
        val limitCheck = subscriptionLimitService.checkFileUploadLimit(userId, courseId)
        if (!limitCheck.allowed) {
            throw SubscriptionLimitException(
                reason = limitCheck.reason ?: "File upload limit reached",
                limit = limitCheck.limit,
                current = limitCheck.current,
                requiredPlan = limitCheck.requiredPlan
            )
        }
        
        if (slideService.addSlideForCourse(userId, courseId, file)) ResponseEntity.status(HttpStatus.CREATED).build() else ResponseEntity.notFound().build()
    }

    @DeleteMapping("/{slideId}")
    fun deleteSlideById(
        @PathVariable courseId: String,
        @PathVariable slideId: String
    ): ResponseEntity<Void> {
        val userId = authenticationService.requireCurrentUserId()
        return if (slideService.deleteSlideById(userId, courseId, slideId)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()
    }

    @PatchMapping("/{slideId}")
    fun updateSlide(
        @PathVariable courseId: String,
        @PathVariable slideId: String,
        @RequestBody patch: PatchSlideDTO
    ): ResponseEntity<Void> {
        val userId = authenticationService.requireCurrentUserId()
        return if (slideService.updateSlide(userId, courseId, slideId , patch)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()
    }

    @GetMapping(params = ["query"])
    fun searchSlidesForUser(
        @PathVariable courseId: String,
        @RequestParam query: String
    ): ResponseEntity<List<Slide>> {
        val userId = authenticationService.requireCurrentUserId()
        val search = slideService.searchSlidesForUser(userId, courseId, query)
        return ResponseEntity.ok(search)
    }

    @GetMapping("/{slideId}/url")
    fun getSlideUrl(
        @PathVariable courseId: String,
        @PathVariable slideId: String
    ): ResponseEntity<String> {
        val userId = authenticationService.requireCurrentUserId()
        val url = slideService.getPresignedSlideUrl(userId, courseId, slideId)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(url)
    }

}