package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.course.Course
import staffbase.lectura.dao.CourseDAO

@Repository
@Profile("local")
class CourseInMemoryDAO : CourseDAO {

    override fun getById(courseId: String): Course? {
        return DataStore.courses.find { it.id == courseId }
    }

    override fun add(course: Course): Boolean = DataStore.courses.add(course)

    override fun update(courseId: String, updated: Course): Boolean {
        val index = DataStore.courses.indexOfFirst { it.id == courseId }
        return if (index != -1) {
            DataStore.courses[index] = updated
            true
        } else {
            false
        }
    }

    override fun delete(courseId: String): Boolean {
        return DataStore.courses.removeIf { it.id == courseId }
    }

    override fun exists(courseId: String): Boolean {
        return DataStore.courses.any { it.id == courseId }
    }
}