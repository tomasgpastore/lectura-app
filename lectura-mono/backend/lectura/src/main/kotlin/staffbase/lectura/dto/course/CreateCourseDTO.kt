package staffbase.lectura.dto.course

import jakarta.validation.constraints.NotBlank

data class CreateCourseDTO(
    @field:NotBlank val code: String,
    @field:NotBlank val name: String
)