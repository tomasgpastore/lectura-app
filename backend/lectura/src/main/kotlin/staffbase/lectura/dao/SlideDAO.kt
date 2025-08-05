package staffbase.lectura.dao

import staffbase.lectura.slide.Slide

interface SlideDAO {
    fun getById(slideId: String): Slide?
    fun add(slide: Slide): Boolean
    fun update(slideId: String, updated: Slide): Boolean
    fun delete(slideId: String): Boolean
    fun exists(slideId: String): Boolean
    suspend fun countByCourseId(courseId: String): Int
}