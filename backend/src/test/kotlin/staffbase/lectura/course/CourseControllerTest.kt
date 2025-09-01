package staffbase.lectura.course

import com.fasterxml.jackson.databind.ObjectMapper
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import io.mockk.every
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.dto.course.CreateCourseDTO
import staffbase.lectura.dto.course.PatchCourseDTO
import staffbase.lectura.dto.course.PatchCourseSummaryDTO
import staffbase.lectura.user.User
import kotlin.time.Instant

@ExtendWith(SpringExtension::class)
@WebMvcTest(CourseController::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CourseControllerTest {

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockkBean
    private lateinit var courseServices: CourseService

    @BeforeEach
    fun resetMocks() = clearMocks(courseServices)

    val courses = listOf(
        Course("1", listOf("1", "2", "3"),"CS101", "Intro to Computer Science","This is the Course Summary"),
        Course("2", listOf("1", "2", "3"), "MATH100", "Basic Mathematics"),
        Course("3", listOf("1", "2", "3"),"PHYS200", "Physics I")
    )
    val course = Course("1", listOf("1", "2", "3"),"CS101", "Intro to Computer Science", "This is the Course Summary")
    val patch = PatchCourseDTO("CS101", "Intro to Computer Science")
    val summaryPatch = PatchCourseSummaryDTO("Updated summary")
    val user = User("1", AuthProvider.GOOGLE, "1", "user@email.com", listOf("1", "2", "3"), "picture.png")
    val courseData = CreateCourseDTO(name = "Intro to Computer Science", code = "CS101")

    /*

    @Test
    fun `should get all courses`() {
        every { coursesServices.getAllCoursesForUser(user.id) } returns courses
        mockMvc.get("/users/${user.id}/courses")
        .andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(courses)) }
        }
    }

     */

    @Test
    fun `should add course`() {
        every { courseServices.createCourseForUser(user.id, courseData) } returns course

        mockMvc.post("/users/${user.id}/courses") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(course)
        }
            .andExpect {
                status { isCreated() }
            }

    }

    @Test
    fun `should get course by id`() {
        every { courseServices.getCourseById(user.id, course.id) } returns course

        mockMvc.get("/users/${user.id}/courses/1")
        .andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(course)) }
        }
    }

    @Test
    fun `should return 404 if course not found`() {
        every { courseServices.getCourseById(user.id, course.id) } returns null

        mockMvc.get("/users/${user.id}/courses/${course.id}")
            .andExpect {
                status { isNotFound() }
            }
    }


    @Test
    fun `should delete course by id `() {
        every { courseServices.deleteCourseByIdForUser(user.id, course.id) } returns true
        mockMvc.delete("/users/${user.id}/courses/${course.id}")
            .andExpect {
                status { isNoContent() }
            }
    }

    @Test
    fun `should return 404 when deleting non-existent course`() {
        every { courseServices.deleteCourseByIdForUser(user.id, course.id) } returns false

        mockMvc.delete("/users/${user.id}/courses/${course.id}")
            .andExpect {
                status { isNotFound() }
            }
    }

    @Test
    fun `should update course`() {
        every { courseServices.updateCourseForUser(user.id, course.id, patch) } returns true

        mockMvc.patch("/users/${user.id}/courses/${course.id}") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(patch)
        }.andExpect {
            status { isNoContent() }
        }
    }

    @Test
    fun `should return a list of filtered courses`() {
        every { courseServices.searchCoursesForUser(user.id, "Intro") } returns courses.filter { it.name.contains("Intro", ignoreCase = true) }
        mockMvc.get("/users/${user.id}/courses") { param("query", "Intro") }
        .andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(courses.filter { it.name.contains("Intro", ignoreCase = true) })) }
        }
    }

    /*

    @Test
    fun `should return the course summary`() {
        every {coursesServices.getCourseSummary(user.id,course.id) } returns course.summary
        mockMvc.get("/users/${user.id}/courses/${course.id}/summary")
            .andExpect {
                status { isOk() }
                content { course.summary }
            }
    }

    @Test
    fun `should update summary`() {
        every { coursesServices.updateCourseSummary(user.id,course.id, summaryPatch) } returns true

        mockMvc.patch("/users/${user.id}/courses/${course.id}/summary") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(summaryPatch)
        }.andExpect {
            status { isNoContent() }
        }
    }

     */

}