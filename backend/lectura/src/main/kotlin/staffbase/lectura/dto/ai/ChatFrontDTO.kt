package staffbase.lectura.dto.ai

import jakarta.validation.constraints.NotBlank
import staffbase.lectura.ai.SearchType

data class ChatFrontDTO(
    @field:NotBlank val courseId: String,
    @field:NotBlank val userPrompt: String,
    val snapshots: List<String> = emptyList(),
    val slidePriority: List<String> = emptyList(),
    val searchType: SearchType = SearchType.DEFAULT,
)
