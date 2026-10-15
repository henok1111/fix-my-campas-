namespace FixMyCampus.Application.DTOs.Tickets;

public record AttachmentFileResponse(
    byte[] Content,
    string ContentType,
    string FileName);
