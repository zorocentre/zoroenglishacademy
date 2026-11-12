package com.zoroacademy.dto;

public class FeedbackMediaPublicDto {
    private String id;
    private String mediaType;
    private String url;
    private String thumbnailUrl;
    private Integer sortOrder;

    public FeedbackMediaPublicDto() {}

    public FeedbackMediaPublicDto(String id, String mediaType, String url, String thumbnailUrl, Integer sortOrder) {
        this.id = id;
        this.mediaType = mediaType;
        this.url = url;
        this.thumbnailUrl = thumbnailUrl;
        this.sortOrder = sortOrder;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getMediaType() {
        return mediaType;
    }

    public void setMediaType(String mediaType) {
        this.mediaType = mediaType;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
