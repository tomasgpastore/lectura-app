package staffbase.lectura.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty
import staffbase.lectura.ai.SearchType

data class SnapshotOutbound(
    @JsonProperty("slide_id")
    val slideId: String,
    @JsonProperty("page_number")
    val pageNumber: Int,
    @JsonProperty("s3key")
    val s3key: String
)

data class ChatOutboundDTO(
    @JsonProperty("course_id")
    val courseId: String,
    @JsonProperty("user_id")
    val userId: String,
    @JsonProperty("user_prompt")
    val userPrompt: String,
    @JsonProperty("slide_priority")
    val slidePriority: List<String> = emptyList(),
    @JsonProperty("search_type")
    val searchType: String = "DEFAULT",
    @JsonProperty("snapshot")
    val snapshot: SnapshotOutbound? = null,
)