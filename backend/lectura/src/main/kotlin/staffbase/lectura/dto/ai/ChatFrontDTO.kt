package staffbase.lectura.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty
import jakarta.validation.constraints.NotBlank
import staffbase.lectura.ai.SearchType

data class Snapshot(
    @JsonProperty("slide_id")
    val slideId: String,
    @JsonProperty("page_number")
    val pageNumber: Int
)

data class ChatFrontDTO(
    @field:NotBlank val courseId: String,
    @field:NotBlank val userPrompt: String,
    val snapshot: Snapshot? = null,
    val priorityDocuments: List<String> = emptyList(),
    val searchType: SearchType = SearchType.DEFAULT,
)
