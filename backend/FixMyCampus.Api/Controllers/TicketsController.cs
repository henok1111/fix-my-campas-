using System.Security.Claims;
using FixMyCampus.Application.Common;
using FixMyCampus.Application.DTOs.Tickets;
using FixMyCampus.Application.Interfaces;
using FixMyCampus.Domain.Enums;
using FixMyCampus.Api.Realtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FixMyCampus.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TicketsController(
    ITicketService ticketService,
    IRealtimeNotifier realtimeNotifier) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "Reporter")]
    public async Task<ActionResult<TicketDetailResponse>> Create(
        [FromBody] CreateTicketRequest request)
    {
        var reporterId = GetCurrentUserId();

        var ticket = await ticketService.CreateAsync(
            request,
            reporterId);

        await realtimeNotifier.TicketsChangedAsync(
            HttpContext.RequestAborted);

        return CreatedAtAction(
            nameof(GetById),
            new { id = ticket.Id },
            ticket);
    }

    [HttpPost("{id:int}/attachments")]
    [Authorize(Roles = "Reporter")]
    [Consumes("multipart/form-data")]
    [RequestFormLimits(MultipartBodyLengthLimit = 50 * 1024 * 1024)]
    public async Task<ActionResult<AttachmentResponse>> UploadAttachment(
        int id,
        [FromForm] IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("A non-empty file is required.");
        }

        await using var content = new MemoryStream();
        await file.OpenReadStream().CopyToAsync(content);

        var attachment = await ticketService.UploadAttachmentAsync(
            id,
            new AttachmentUploadRequest(
                content.ToArray(),
                file.FileName,
                file.ContentType,
                file.Length),
            GetCurrentUserId());

        await realtimeNotifier.TicketsChangedAsync(
            HttpContext.RequestAborted);

        return Ok(attachment);
    }

    [HttpGet("{id:int}/attachments/{attachmentId:int}/file")]
    [Authorize]
    public async Task<IActionResult> DownloadAttachment(
        int id,
        int attachmentId)
    {
        var file = await ticketService.DownloadAttachmentAsync(
            id,
            attachmentId,
            GetCurrentUserId(),
            CanViewAllTickets);

        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Technician")]
    public async Task<ActionResult<PagedResult<TicketListItemResponse>>> GetFeed(
        [FromQuery] TicketQueryParameters query)
    {
        var result = await ticketService.GetFeedAsync(query);

        return Ok(result);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Reporter")]
    public async Task<ActionResult<PagedResult<TicketListItemResponse>>> GetMine(
        [FromQuery] TicketQueryParameters query)
    {
        var reporterId = GetCurrentUserId();

        var result = await ticketService.GetMineAsync(
            reporterId,
            query);

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TicketDetailResponse>> GetById(
        int id)
    {
        var ticket = await ticketService.GetByIdAsync(
            id,
            GetCurrentUserId(),
            CanViewAllTickets);

        return Ok(ticket);
    }

    [HttpGet("similar")]
    [Authorize(Roles = "Reporter")]
    public async Task<ActionResult<IReadOnlyList<TicketListItemResponse>>> FindSimilar(
        [FromQuery] int buildingId,
        [FromQuery] string room,
        [FromQuery] TicketCategory category)
    {
        var tickets = await ticketService.FindSimilarOpenAsync(
            buildingId,
            room,
            category);

        return Ok(tickets);
    }

    [HttpPost("{id:int}/assign")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<TicketDetailResponse>> Assign(
        int id,
        [FromBody] AssignTicketRequest request)
    {
        var adminId = GetCurrentUserId();

        var ticket = await ticketService.AssignAsync(
            id,
            request,
            adminId);

        await realtimeNotifier.TicketsChangedAsync(
            HttpContext.RequestAborted);

        return Ok(ticket);
    }

    [HttpPost("{id:int}/status")]
    [Authorize(Roles = "Admin,Technician")]
    public async Task<ActionResult<TicketDetailResponse>> ChangeStatus(
        int id,
        [FromBody] ChangeStatusRequest request)
    {
        var userId = GetCurrentUserId();

        var ticket = await ticketService.ChangeStatusAsync(
            id,
            request,
            userId);

        await realtimeNotifier.TicketsChangedAsync(
            HttpContext.RequestAborted);

        return Ok(ticket);
    }

    [HttpPost("{id:int}/confirm-fix")]
    [Authorize(Roles = "Reporter")]
    public async Task<ActionResult<TicketDetailResponse>> ConfirmFix(
        int id)
    {
        var reporterId = GetCurrentUserId();

        var ticket = await ticketService.ConfirmFixAsync(
            id,
            reporterId);

        await realtimeNotifier.TicketsChangedAsync(
            HttpContext.RequestAborted);

        return Ok(ticket);
    }

    private string GetCurrentUserId()
    {
        var userId = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userId))
            throw new UnauthorizedAccessException(
                "Authenticated user ID is missing.");

        return userId;
    }

    private bool CanViewAllTickets =>
        User.IsInRole("Admin") || User.IsInRole("Technician");
}