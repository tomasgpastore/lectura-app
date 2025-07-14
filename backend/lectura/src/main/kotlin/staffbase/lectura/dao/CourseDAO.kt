package staffbase.lectura.dao

import staffbase.lectura.course.Course

interface CourseDAO {
    fun getById(courseId: String): Course?
    fun add(course: Course): Boolean
    fun update(courseId: String, updated: Course): Boolean
    fun delete(courseId: String): Boolean
    fun exists(courseId: String): Boolean
}