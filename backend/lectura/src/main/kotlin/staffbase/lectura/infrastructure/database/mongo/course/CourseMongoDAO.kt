package staffbase.lectura.infrastructure.database.mongo.course

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.course.Course
import staffbase.lectura.dao.CourseDAO
import java.time.Instant

@Repository
@Profile("remote")
class CourseMongoDAO(
    private val courseRepo: CourseMongoRepository
) : CourseDAO {

    override fun getById(courseId: String): Course? {
        return courseRepo.findByIdAndDeletedAtIsNull(courseId)
    }

    override fun add(course: Course): Boolean {
        courseRepo.save(course)
        return true
    }

    override fun update(courseId: String, updated: Course): Boolean {
        return if (courseRepo.existsByIdAndDeletedAtIsNull(courseId)) {
            courseRepo.save(updated)
            true
        } else {
            false
        }
    }

    override fun delete(courseId: String): Boolean {
        val course = courseRepo.findByIdAndDeletedAtIsNull(courseId)
        if (course != null) {
            course.deletedAt = Instant.now()
            courseRepo.save(course)
            return true
        }
        return false
    }

    override fun exists(courseId: String): Boolean {
        return courseRepo.existsByIdAndDeletedAtIsNull(courseId)
    }

    fun hardDelete(courseId: String): Boolean {
        return if (courseRepo.existsByIdAndDeletedAtIsNull(courseId)) {
            courseRepo.deleteById(courseId)
            true
        } else {
            false
        }
    }

}