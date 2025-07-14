package staffbase.lectura.slide

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
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.result.MockMvcResultMatchers
import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.course.Course
import staffbase.lectura.dto.slide.PatchSlideDTO
import staffbase.lectura.user.User
import java.time.LocalDateTime

@ExtendWith(SpringExtension::class)
@WebMvcTest(SlideController::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SlideControllerTest {
    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockkBean
    private lateinit var slideService: SlideService

    @BeforeEach
    fun resetMocks() = clearMocks(slideService)

    val slide = Slide(
        id = "1",
        originalFileName = "Lecture1.pdf",
        contentType = "application/pdf",
        fileSize = 204800, // in bytes
        courseId = "12123",
        pageCount = 12,
        storageFileName = "courses/123/slides/slide1.pdf",
    )

    val slides = listOf(
        slide,
        Slide(
            id = "1",
            originalFileName = "Lecture2.pptx",
            contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            fileSize = 512000,
            courseId = "12123",
            pageCount = 12,
            storageFileName = "courses/123/slides/slide2.pptx",
        )
    )

    val patch = PatchSlideDTO(
        originalFileName = "Lecture1_Updated.pdf"
    )

    val user = User("1", AuthProvider.GOOGLE, "1", "user@email.com", listOf("1", "2", "3"), "picture.png")

    val course = Course("1", listOf("1", "2", "3"), "CS101", "Intro to Computer Science", "This is the Course Summary")

    val file = MockMultipartFile(
        "file",                        // name of the parameter
        "test.pdf",                    // original file name
        "application/pdf",            // content type
        "Sample PDF content".byteInputStream() // file content as InputStream
    )

    @Test
    fun `should get slide by id`() {
        every { slideService.getSlideById(user.id, course.id, slide.id) } returns slide

        mockMvc.get("/users/${user.id}/courses/${course.id}/slides/${slide.id}")
            .andExpect {
                status { isOk() }
                content { json(objectMapper.writeValueAsString(slide)) }
            }
    }

    @Test
    fun `should add slide for course`() {
        val file = MockMultipartFile(
            "file",                     // must match @RequestParam("file")
            "lecture.pdf",
            "application/pdf",
            "Sample file content".byteInputStream()
        )

        every { slideService.addSlideForCourse(user.id, course.id, file) } returns true

        mockMvc.perform(
            MockMvcRequestBuilders.multipart("/users/${user.id}/courses/${course.id}/slides")
                .file(file)
                .with { it.method = "POST"; it }
        ).andExpect(MockMvcResultMatchers.status().isCreated)
    }

    @Test
    fun `should delete slide by id`() {
        every { slideService.deleteSlideById(user.id, course.id, slide.id) } returns true

        mockMvc.delete("/users/${user.id}/courses/${course.id}/slides/${slide.id}")
        .andExpect {
            status { isNoContent() }
        }
    }

    @Test
    fun `should return 404 when deleting non-existing slide`() {
        every { slideService.deleteSlideById(user.id, course.id, slide.id) } returns false

        mockMvc.delete("/users/${user.id}/courses/${course.id}/slides/${slide.id}")
            .andExpect {
                status { isNotFound() }
            }
    }

    @Test
    fun `should update a slide for course`() {
        every { slideService.updateSlide(user.id, course.id, slide.id, patch) } returns true

        mockMvc.patch("/users/${user.id}/courses/${course.id}/slides/${slide.id}") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(patch)
        }.andExpect { status { isNoContent() } }
    }

    @Test
    fun `should return a list of filtered slides`() {
        every { slideService.searchSlidesForUser(user.id, course.id, "Lec") } returns slides.filter { it.originalFileName.contains("Lec", ignoreCase = true) }

        mockMvc.get("/users/${user.id}/courses/${course.id}/slides") { param("query", "Lec") }
        .andExpect {
            status { isOk() }
            content {
                json(objectMapper.writeValueAsString(slides.filter {
                    it.originalFileName.contains(
                        "Lec",
                        ignoreCase = true
                    )
                }))
            }
        }
    }


}