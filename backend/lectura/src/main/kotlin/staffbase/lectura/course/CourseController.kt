package staffbase.lectura.course

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import staffbase.lectura.auth.AuthenticationService
import staffbase.lectura.dto.course.CreateCourseDTO
import staffbase.lectura.dto.course.PatchCourseDTO

@RestController
@RequestMapping("/courses")
class CourseController(
    val courseServices: CourseService, 
    val authenticationService: AuthenticationService
){
    
    @GetMapping
    fun getAllCoursesForUser(): ResponseEntity<List<Course>>{
        val userId = authenticationService.requireCurrentUserId()
        val courses = courseServices.getAllCoursesForUser(userId)
        return ResponseEntity.ok(courses)
    }

    @PostMapping
    fun createCourseForUser(@RequestBody @Valid courseData: CreateCourseDTO): ResponseEntity<Void> {
        val userId = authenticationService.requireCurrentUserId()
        courseServices.createCourseForUser(userId, courseData)
        return ResponseEntity.status(HttpStatus.CREATED).build()
    }

    @GetMapping("/{courseId}")
    fun getCourseById(@PathVariable courseId: String): ResponseEntity<Course> {
        val userId = authenticationService.requireCurrentUserId()
        val course = courseServices.getCourseById(userId, courseId)
        return if (course != null) {
            ResponseEntity.ok().body(course)
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @DeleteMapping("/{courseId}")
    fun deleteCourseByIdForUser(@PathVariable courseId: String): ResponseEntity<Void> {
        val userId = authenticationService.requireCurrentUserId()
        return if (courseServices.deleteCourseByIdForUser(userId, courseId)){
            ResponseEntity.noContent().build()
        } else { ResponseEntity.notFound().build() }
        }

    @PatchMapping("/{courseId}")
    fun updateCourse(@PathVariable courseId: String, @RequestBody patch: PatchCourseDTO): ResponseEntity<Void> {
        val userId = authenticationService.requireCurrentUserId()
        return if (courseServices.updateCourseForUser(userId, courseId, patch)){
            ResponseEntity.noContent().build()
        } else { ResponseEntity.notFound().build() }
    }

    @GetMapping(params = ["query"])
    fun searchCoursesForUser(@RequestParam query: String): ResponseEntity<List<Course>> {
        val userId = authenticationService.requireCurrentUserId()
        val search = courseServices.searchCoursesForUser(userId, query)
        return ResponseEntity.ok(search)
    }

    /*

    @GetMapping("/{courseId}/summary")
    fun getCourseSummary(@RequestHeader("Authorization") authHeader: String, @PathVariable courseId: String): ResponseEntity<GetCourseSummaryDTO>{
        val userId = jwtService.extractUserIdFromHeader(authHeader)
        val summary = coursesServices.getCourseSummary(userId, courseId)
        return if (summary != null){
            ResponseEntity.ok(GetCourseSummaryDTO(summary))
        } else { ResponseEntity.notFound().build() }
    }

    @PatchMapping("/{courseId}/summary")
    fun updateCourseSummary(@RequestHeader("Authorization") authHeader: String, @PathVariable courseId: String, @RequestBody patch: PatchCourseSummaryDTO): ResponseEntity<Void> {
        val userId = jwtService.extractUserIdFromHeader(authHeader)
        return if(coursesServices.updateCourseSummary(userId, courseId, patch)){
            ResponseEntity.noContent().build()
        } else { ResponseEntity.notFound().build() }
    }

    */

}