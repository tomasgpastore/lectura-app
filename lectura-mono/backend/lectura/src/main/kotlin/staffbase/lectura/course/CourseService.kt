package staffbase.lectura.course

import org.springframework.stereotype.Service
import staffbase.lectura.dao.CourseDAO
import staffbase.lectura.dto.course.CreateCourseDTO
import staffbase.lectura.dto.course.PatchCourseDTO
import staffbase.lectura.dto.course.PatchCourseSummaryDTO
import staffbase.lectura.user.UserService
import java.util.UUID

@Service
class CourseService(val userService: UserService, val courseDAO: CourseDAO) {

    fun getAllCoursesForUser(userId : String): List<Course> {
        val user = userService.getUserById(userId) ?: return emptyList()

        return user.courseId.mapNotNull { courseId -> courseDAO.getById(courseId) }
    }

    fun getCourseById(userId: String, courseId: String): Course?{
        val user = userService.getUserById(userId) ?: return null
        return if (user.courseId.contains(courseId)) {
            courseDAO.getById(courseId)
        } else {
            null
        }
    }

    fun createCourseForUser(userId: String, courseData: CreateCourseDTO): Course? {
        // Check if user exists
        val user = userService.getUserById(userId) ?: return null

        // Create new course object
        val newCourse = Course(
            id = UUID.randomUUID().toString(),
            slideId = emptyList(),
            code = courseData.code,
            name = courseData.name,
            summary = null
        )

        // Add course to DB
        if(!courseDAO.add(newCourse)) return null

        // Create new user object with updated courseId list
        val updatedUser = user.copy(courseId = user.courseId + newCourse.id)

        // Replace user object with updated one
        return  if (userService.updateUser(userId, updatedUser)) newCourse else null
    }

    fun updateCourse(courseId: String, updatedCourse: Course): Boolean {
        return courseDAO.update(courseId, updatedCourse)
    }

    fun deleteCourseByIdForUser(userId: String, courseId: String): Boolean {
        val user = userService.getUserById(userId) ?: return false

        if (courseId !in user.courseId) return true

        val newCourseList = user.courseId.filter { it != courseId }
        val updatedUser = user.copy(courseId = newCourseList)

        val wasUpdated = userService.updateUser(userId, updatedUser)

        if(wasUpdated && !userService.anyUserInCourse(courseId)){
            courseDAO.delete(courseId)
        }

        return wasUpdated
    }

    fun updateCourseForUser(userId: String, courseId: String, patch: PatchCourseDTO): Boolean {
        val user = userService.getUserById(userId) ?: return false

        if (courseId !in user.courseId) return false

        val originalCourse = courseDAO.getById(courseId) ?: return false

        val finalCode = patch.code ?: originalCourse.code
        val finalName = patch.name ?: originalCourse.name

        val isSame = originalCourse.code == finalCode && originalCourse.name == finalName
        if (isSame) return true

        val updatedCourse = originalCourse.copy(code = finalCode, name = finalName)

        return courseDAO.update(courseId, updatedCourse)
    }

    fun searchCoursesForUser(userId: String, query: String): List<Course>{
        val userCourses = getAllCoursesForUser(userId)

        return userCourses.filter {
            it.name.contains(query, ignoreCase = true) ||
                    it.code.contains(query, ignoreCase = true)
        }
    }

    fun getCourseSummary(userId: String, courseId: String): String? {
        val user = userService.getUserById(userId) ?: return null

        if (courseId !in user.courseId) return null

        val course = courseDAO.getById(courseId) ?: return null

        return course.summary
    }

    fun updateCourseSummary(userId: String, courseId: String, patch: PatchCourseSummaryDTO): Boolean{
        val user = userService.getUserById(userId) ?: return false

        if (courseId !in user.courseId) return false

        val originalCourse = courseDAO.getById(courseId) ?: return false

        val updatedCourse = originalCourse.copy(summary = patch.summary ?: originalCourse.summary)

        return courseDAO.update(courseId, updatedCourse)
    }

    //Should add course sharing functionality

    //Should add function to know the users with a certain course
}