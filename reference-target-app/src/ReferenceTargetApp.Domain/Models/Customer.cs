namespace ReferenceTargetApp.Domain.Models;

public sealed record Customer(
    string CompanyName,
    string ContactName,
    string Street,
    string PostalCode,
    string City,
    string Email);
