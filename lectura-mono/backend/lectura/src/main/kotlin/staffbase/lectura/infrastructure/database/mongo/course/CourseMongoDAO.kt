package staffbase.lectura.infrastructure.database.mongo.course

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.course.Course
import staffbase.lectura.dao.CourseDAO

@Repository
@Profile("remote")
class CourseMongoDAO(
    private val courseRepo: CourseMongoRepository
) : CourseDAO {

    override fun getById(courseId: String): Course? {
        return courseRepo.findById(courseId).orElse(null)
    }

    override fun add(course: Course): Boolean {
        courseRepo.save(course)
        return true
    }

    override fun update(courseId: String, updated: Course): Boolean {
        return if (courseRepo.existsById(courseId)) {
            courseRepo.save(updated)
            true
        } else {
            false
        }
    }

    override fun delete(courseId: String): Boolean {
        return if (courseRepo.existsById(courseId)) {
            courseRepo.deleteById(courseId)
            true
        } else {
            false
        }
    }

    override fun exists(courseId: String): Boolean {
        return courseRepo.existsById(courseId)
    }
}