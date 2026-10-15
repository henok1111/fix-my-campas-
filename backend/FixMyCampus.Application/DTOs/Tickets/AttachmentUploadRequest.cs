namespace FixMyCampus.Application.DTOs.Tickets;

public record AttachmentUploadRequest(
    byte[] Content,
    string OriginalFileName,
    string ContentType,
    long SizeInBytes);
