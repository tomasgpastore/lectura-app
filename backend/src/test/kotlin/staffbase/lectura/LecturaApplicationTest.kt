package staffbase.lectura

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.junit.jupiter.SpringExtension
import staffbase.lectura.course.CourseController

@ExtendWith(SpringExtension::class)
@WebMvcTest(CourseController::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@SpringBootTest
class LecturaApplicationTest {

	@Test
	fun contextLoads() {
	}

}
