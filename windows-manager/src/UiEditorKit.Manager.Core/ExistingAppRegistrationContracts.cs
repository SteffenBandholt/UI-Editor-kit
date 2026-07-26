using System.Security.Cryptography;
using System.Text;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Core;

public interface IExistingProjectAdapter
{
    string AdapterVersion { get; }
    Task<RegistrationAnalysisResult> AnalyzeAsync(string selectedPath, CancellationToken cancellationToken = default);
}

public interface IXamlSourceAnalyzer
{
    Task<IReadOnlyList<UiSourceFinding>> AnalyzeAsync(string root, string relativeFile, CancellationToken cancellationToken = default);
}

public interface ICSharpSourceAnalyzer
{
    Task<IReadOnlyList<CodeActionFinding>> AnalyzeAsync(string root, string relativeFile, CancellationToken cancellationToken = default);
}

public interface IProjectFileAdapter
{
    Task<(ProjectFileAnalysis? Project, ManagerResult Result)> AnalyzeAsync(string root, string projectFile, CancellationToken cancellationToken = default);
}

public interface IRegistrationArtifactGenerator
{
    Task<(GeneratedRegistrationRegistry? Registry, IReadOnlyList<RegistrationGeneratedFile> Files, ManagerResult Result)> GenerateAsync(
        ExistingAppAnalysis analysis,
        CancellationToken cancellationToken = default);
}

public interface IRegistrationContractChecker
{
    Task<ManagerResult> CheckAsync(string targetRoot, ExistingAppAnalysis analysis, GeneratedRegistrationRegistry registry,
        CancellationToken cancellationToken = default);
}

public static class RegistrationVocabulary
{
    public static readonly IReadOnlySet<string> ElementTypes = new HashSet<string>(StringComparer.Ordinal)
    {
        "root", "area", "group", "subgroup", "component", "componentPart", "table", "tableColumn",
        "list", "card", "dialog", "toolbar", "button", "field", "label", "statusIndicator"
    };

    public static readonly IReadOnlySet<string> Roles = new HashSet<string>(StringComparer.Ordinal)
    {
        "layout", "content", "meta", "structure", "status", "date", "responsible", "visibility",
        "action", "navigation", "editor-launcher", "system"
    };

    public static readonly IReadOnlySet<string> Operations = new HashSet<string>(StringComparer.Ordinal)
    {
        "inspect", "show", "hide", "move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize",
        "reorder", "rename", "changeWidth", "pin", "unpin", "reset", "applyPreset", "delete",
        "executeTargetAction", "modifyDomainData"
    };

    public static readonly IReadOnlySet<string> TableColumnRoles = new HashSet<string>(StringComparer.Ordinal)
    {
        "contentColumn", "metaColumn", "structureColumn", "statusColumn", "dateColumn", "responsibleColumn",
        "visibilityColumn", "actionColumn"
    };

    public static readonly IReadOnlySet<string> ForbiddenAllowedOperations = new HashSet<string>(StringComparer.Ordinal)
    {
        "delete", "executeTargetAction", "modifyDomainData"
    };
}

public static class StableRegistrationIds
{
    public static string ApplicationId(string value)
    {
        var slug = Slug(value);
        if (slug.Length < 3) slug = "app-" + slug;
        return slug.Length <= 80 ? slug : slug[..80].TrimEnd('-');
    }

    public static string? ElementId(string applicationId, UiSourceFinding finding)
    {
        var declared = string.IsNullOrWhiteSpace(finding.DeclaredName) ? null : Slug(finding.DeclaredName);
        if (declared is null) return null;
        var view = Slug(PathStem(finding.SourceLocation.RelativeFile));
        return $"ui.{Slug(applicationId)}.{view}.{declared}";
    }

    public static string ProposalId(UiSourceFinding finding)
    {
        var canonical = $"{finding.SourceLocation.RelativeFile}|{finding.DeclaredName ?? string.Empty}|{finding.StructuralPath}|{finding.ControlType}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
        return "proposal-" + hash[..16];
    }

    private static string PathStem(string path)
    {
        var normalized = path.Replace('\\', '/');
        var withoutExtension = normalized.EndsWith(".xaml", StringComparison.OrdinalIgnoreCase) ? normalized[..^5] : normalized;
        return withoutExtension.Replace('/', '-');
    }

    public static string Slug(string value)
    {
        var result = new StringBuilder(value.Length);
        var pendingDash = false;
        foreach (var character in value.Normalize(NormalizationForm.FormD))
        {
            if (character is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                if (pendingDash && result.Length > 0) result.Append('-');
                result.Append(character); pendingDash = false;
            }
            else if (character is >= 'A' and <= 'Z')
            {
                if (pendingDash && result.Length > 0) result.Append('-');
                result.Append(char.ToLowerInvariant(character)); pendingDash = false;
            }
            else if (char.IsLetterOrDigit(character))
            {
                if (pendingDash && result.Length > 0) result.Append('-');
                result.Append(char.ToLowerInvariant(character)); pendingDash = false;
            }
            else pendingDash = result.Length > 0;
        }
        return result.ToString().Trim('-');
    }
}

public static class RegistrationProposalGenerator
{
    private static readonly HashSet<string> TextTypes = new(StringComparer.OrdinalIgnoreCase)
        { "TextBox", "PasswordBox", "ComboBox", "DatePicker", "TextBlock", "Label", "CheckBox", "RadioButton", "Button" };
    private static readonly HashSet<string> Containers = new(StringComparer.OrdinalIgnoreCase)
        { "Grid", "StackPanel", "DockPanel", "WrapPanel", "Canvas", "Border", "GroupBox", "Expander", "TabControl", "TabItem" };

    public static IReadOnlyList<RegistrationProposal> Create(string applicationId, IReadOnlyList<UiSourceFinding> findings,
        IReadOnlyList<CodeActionFinding> actions)
    {
        var ordered = findings.OrderBy(item => item.SourceLocation.RelativeFile, StringComparer.Ordinal)
            .ThenBy(item => item.SourceLocation.Line).ThenBy(item => item.SourceLocation.Column).ToArray();
        var idsByPath = ordered.ToDictionary(item => Key(item), item => StableRegistrationIds.ElementId(applicationId, item), StringComparer.Ordinal);
        var result = new List<RegistrationProposal>(ordered.Length);
        var order = 0;
        foreach (var finding in ordered)
        {
            var id = idsByPath[Key(finding)];
            var parentId = finding.ParentStructuralPath is null ? null : idsByPath.GetValueOrDefault(
                finding.SourceLocation.RelativeFile + "|" + finding.ParentStructuralPath);
            var type = ElementType(finding);
            var actionRisk = ActionRisk(finding, actions);
            var warnings = finding.Warnings.ToList();
            if (id is null) warnings.Add("Kein stabiler deklarierter Name; manuelle Element-ID erforderlich.");
            if (finding.ParentStructuralPath is not null && parentId is null)
                warnings.Add("Parent besitzt noch keine stabile ID; Parent muss manuell bestätigt werden.");
            if (actionRisk is not null) warnings.Add("Fachaktionsbindung bleibt vollständig gesperrt.");
            var clarification = id is null || (finding.ParentStructuralPath is not null && parentId is null) || finding.IsTemplateOrDynamic;
            var locked = actionRisk is null ? Array.Empty<string>() : ["executeTargetAction", "modifyDomainData"];
            result.Add(new(
                StableRegistrationIds.ProposalId(finding), finding.SourceLocation, finding.Framework, finding.ControlType,
                finding.DeclaredName, finding.StructuralPath, id, finding.DeclaredName ?? finding.ControlType, type,
                Role(type, finding), parentId, order++, AllowedOperations(type, finding), locked,
                finding.IsTemplateOrDynamic ? EditorEligibility.Unclear : EditorEligibility.Yes, actionRisk, finding.Confidence,
                Reason(finding, type), warnings.Distinct(StringComparer.Ordinal).ToArray(),
                clarification ? ProposalReviewStatus.ClarificationRequired : ProposalReviewStatus.Unreviewed,
                FieldKind(finding), ColumnRole(finding), actionRisk is null ? null : "businessAction",
                type is "component" or "componentPart" ? finding.ControlType : null));
        }
        return result;
    }

    public static IReadOnlyList<RegistrationProposal> PreserveSafeDecisions(
        IReadOnlyList<RegistrationProposal> current,
        IReadOnlyList<RegistrationProposal> previous)
    {
        var matchedPreviousIds = new HashSet<string>(StringComparer.Ordinal);
        var preserved = current.Select(item =>
        {
            var candidates = previous.Where(prior => CanPreserve(item, prior) &&
                                                       prior.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified).ToArray();
            var prior = candidates.Length == 1 ? candidates[0] : null;
            if (prior is not null) matchedPreviousIds.Add(prior.ProposalId);
            return prior is not null
            ? item with
            {
                StableElementId = prior.StableElementId,
                DisplayName = prior.DisplayName,
                ElementType = prior.ElementType,
                Role = prior.Role,
                ParentId = prior.ParentId,
                Order = prior.Order,
                AllowedOps = prior.AllowedOps,
                LockedOps = prior.LockedOps,
                EditorEligible = prior.EditorEligible,
                ReviewStatus = prior.ReviewStatus,
                FieldKind = prior.FieldKind,
                ColumnRole = prior.ColumnRole,
                ActionKind = prior.ActionKind,
                ComponentKind = prior.ComponentKind,
                UserNote = prior.UserNote
            }
            : item;
        }).ToList();
        preserved.AddRange(previous
            .Where(item => item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified &&
                           !matchedPreviousIds.Contains(item.ProposalId))
            .Select(item => item with
            {
                EditorEligible = EditorEligibility.Unclear,
                ReviewStatus = ProposalReviewStatus.ClarificationRequired,
                Reason = "Zuvor bestätigte Quellfundstelle ist in der aktuellen Analyse nicht mehr vorhanden; Beibehalten oder Entfernen muss ausdrücklich entschieden werden.",
                Warnings = item.Warnings.Concat(["Verwaister bestätigter Registrierungsvorschlag; keine automatische Löschung."])
                    .Distinct(StringComparer.Ordinal).ToArray(),
                UserNote = null
            }));
        return preserved.OrderBy(item => item.Order).ThenBy(item => item.ProposalId, StringComparer.Ordinal).ToArray();
    }

    private static bool CanPreserve(RegistrationProposal current, RegistrationProposal previous) =>
        current.ControlType == previous.ControlType &&
        current.SourceLocation.RelativeFile == previous.SourceLocation.RelativeFile &&
        (!string.IsNullOrWhiteSpace(current.DeclaredName)
            ? current.DeclaredName == previous.DeclaredName
            : current.ProposalId == previous.ProposalId && current.SourceLocation == previous.SourceLocation);

    private static string Key(UiSourceFinding finding) => finding.SourceLocation.RelativeFile + "|" + finding.StructuralPath;
    private static string ElementType(UiSourceFinding finding)
    {
        if (finding.IsView && finding.ControlType.EndsWith("Window", StringComparison.OrdinalIgnoreCase)) return "root";
        if (finding.IsView) return "area";
        if (finding.ControlType.Contains("DataGrid", StringComparison.OrdinalIgnoreCase) &&
            finding.ControlType.EndsWith("Column", StringComparison.OrdinalIgnoreCase)) return "tableColumn";
        if (finding.ControlType.Equals("DataGrid", StringComparison.OrdinalIgnoreCase)) return "table";
        if (finding.ControlType.Equals("ListView", StringComparison.OrdinalIgnoreCase) || finding.ControlType.Equals("ListBox", StringComparison.OrdinalIgnoreCase)) return "list";
        if (finding.ControlType.Equals("Button", StringComparison.OrdinalIgnoreCase)) return "button";
        if (finding.ControlType is "TextBlock" or "Label") return "label";
        if (finding.ControlType is "TextBox" or "PasswordBox" or "ComboBox" or "DatePicker" or "CheckBox" or "RadioButton") return "field";
        if (Containers.Contains(finding.ControlType)) return "group";
        return "component";
    }

    private static string Role(string type, UiSourceFinding finding)
    {
        if (type == "button") return "action";
        if (type is "root" or "area" or "group" or "table" or "tableColumn" or "list") return "structure";
        if (finding.ControlType.Contains("Status", StringComparison.OrdinalIgnoreCase)) return "status";
        return "content";
    }

    private static IReadOnlyList<string> AllowedOperations(string type, UiSourceFinding finding) => type switch
    {
        "root" => ["inspect"],
        "tableColumn" => ["inspect", "changeWidth"],
        "area" or "group" or "table" or "list" or "component" =>
            ["inspect", "move", "resize", "resizeWidth", "resizeHeight"],
        "label" when finding.ControlType.Equals("TextBlock", StringComparison.OrdinalIgnoreCase) =>
            ["inspect", "move", "resize", "resizeWidth", "resizeHeight", "textResize"],
        "field" or "label" or "button" when TextTypes.Count > 0 =>
            ["inspect", "move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize"],
        _ => ["inspect"]
    };

    private static string? FieldKind(UiSourceFinding finding) => finding.ControlType switch
    {
        "CheckBox" => "checkbox", "RadioButton" => "radio", "DatePicker" => "date", "PasswordBox" => "password",
        "ComboBox" => "selection", "TextBox" => "text", _ => null
    };

    private static string? ColumnRole(UiSourceFinding finding)
    {
        if (!finding.ControlType.Contains("DataGrid", StringComparison.OrdinalIgnoreCase) ||
            !finding.ControlType.EndsWith("Column", StringComparison.OrdinalIgnoreCase)) return null;
        return finding.EventBindings.Count > 0 ? "actionColumn" : "contentColumn";
    }

    private static string Reason(UiSourceFinding finding, string type) =>
        $"Strukturiert aus {finding.ControlType} in {finding.SourceLocation.RelativeFile}:{finding.SourceLocation.Line} als {type} abgeleitet; Nutzerprüfung erforderlich.";

    private static string? ActionRisk(UiSourceFinding finding, IReadOnlyList<CodeActionFinding> actions)
    {
        var bindings = finding.EventBindings.Concat(finding.Bindings).ToArray();
        var correlated = actions.Where(action => bindings.Any(binding => binding.Contains(action.Symbol, StringComparison.OrdinalIgnoreCase))).ToArray();
        if (correlated.Length > 0) return string.Join(", ", correlated.Select(item => item.RiskCategory).Distinct(StringComparer.Ordinal));
        if (bindings.Count(binding => binding.Contains("Command", StringComparison.OrdinalIgnoreCase) || binding.Contains("Click", StringComparison.OrdinalIgnoreCase)) > 0)
            return "unknownAction";
        return null;
    }
}

public static class RegistrationProposalValidator
{
    public static RegistrationValidationResult Validate(IReadOnlyList<RegistrationProposal> proposals, bool requireAllDecided = true)
    {
        var issues = new List<RegistrationValidationIssue>();
        if (requireAllDecided)
        {
            foreach (var item in proposals.Where(item => item.ReviewStatus is ProposalReviewStatus.Unreviewed or ProposalReviewStatus.ClarificationRequired))
                issues.Add(new(ManagerErrorCodes.RegistrationProposalUnreviewed, "Vorschlag ist noch nicht abschließend geprüft.", item.ProposalId));
            foreach (var item in proposals.Where(item => item.ReviewStatus == ProposalReviewStatus.Blocked))
                issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "Blockierter Vorschlag verhindert die Installation.", item.ProposalId));
        }

        var accepted = proposals.Where(item => item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified).ToArray();
        foreach (var item in accepted)
        {
            if (string.IsNullOrWhiteSpace(item.StableElementId)) issues.Add(new(ManagerErrorCodes.RegistrationIdMissing, "Stabile Element-ID fehlt.", item.ProposalId, "stableElementId"));
            if (!RegistrationVocabulary.ElementTypes.Contains(item.ElementType)) issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "Elementtyp ist nicht Teil des bestehenden Vertrags.", item.ProposalId, "elementType"));
            if (!RegistrationVocabulary.Roles.Contains(item.Role)) issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "Rolle ist nicht Teil des bestehenden Vertrags.", item.ProposalId, "role"));
            if (item.AllowedOps.Any(op => !RegistrationVocabulary.Operations.Contains(op) || RegistrationVocabulary.ForbiddenAllowedOperations.Contains(op)))
                issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "allowedOps enthält eine unbekannte oder fachliche Operation.", item.ProposalId, "allowedOps"));
            if (item.LockedOps.Any(op => !RegistrationVocabulary.Operations.Contains(op)))
                issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "lockedOps enthält eine unbekannte Operation.", item.ProposalId, "lockedOps"));
            if (item.AllowedOps.Intersect(item.LockedOps, StringComparer.Ordinal).Any())
                issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "Operation ist gleichzeitig erlaubt und gesperrt.", item.ProposalId));
            if (item.ActionRisk is not null && (!item.LockedOps.Contains("executeTargetAction", StringComparer.Ordinal) || item.AllowedOps.Contains("executeTargetAction", StringComparer.Ordinal)))
                issues.Add(new(ManagerErrorCodes.RegistrationActionRisk, "Erkannte Fachaktion ist nicht vollständig gesperrt.", item.ProposalId));
            if (item.ElementType == "tableColumn" && !RegistrationVocabulary.TableColumnRoles.Contains(item.ColumnRole ?? string.Empty))
                issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "Tabellenspalte benötigt eine gültige columnRole.", item.ProposalId, "columnRole"));
        }

        foreach (var duplicate in accepted.Where(item => !string.IsNullOrWhiteSpace(item.StableElementId))
                     .GroupBy(item => item.StableElementId!, StringComparer.Ordinal).Where(group => group.Count() > 1))
            foreach (var item in duplicate) issues.Add(new(ManagerErrorCodes.RegistrationIdConflict, $"Element-ID '{duplicate.Key}' ist nicht eindeutig.", item.ProposalId));

        var byId = accepted.Where(item => !string.IsNullOrWhiteSpace(item.StableElementId))
            .GroupBy(item => item.StableElementId!, StringComparer.Ordinal).ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
        var roots = accepted.Where(item => item.ElementType == "root").ToArray();
        if (roots.Length != 1) issues.Add(new(ManagerErrorCodes.RegistrationRegistryInvalid, "Registry benötigt genau ein root-Element."));
        foreach (var item in accepted)
        {
            if (item.ElementType == "root")
            {
                if (!string.IsNullOrWhiteSpace(item.ParentId)) issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "root darf keinen Parent besitzen.", item.ProposalId, "parentId"));
                continue;
            }
            if (string.IsNullOrWhiteSpace(item.ParentId) || !byId.ContainsKey(item.ParentId))
                issues.Add(new(ManagerErrorCodes.RegistrationParentMissing, "Parent fehlt oder ist nicht bestätigt.", item.ProposalId, "parentId"));
            else if (item.ElementType == "tableColumn" && byId[item.ParentId].ElementType != "table")
                issues.Add(new(ManagerErrorCodes.RegistrationProposalInvalid, "tableColumn benötigt table als Parent.", item.ProposalId, "parentId"));
        }
        ValidateCycles(accepted, byId, issues);
        return new(issues);
    }

    private static void ValidateCycles(IReadOnlyList<RegistrationProposal> accepted,
        IReadOnlyDictionary<string, RegistrationProposal> byId, ICollection<RegistrationValidationIssue> issues)
    {
        foreach (var item in accepted.Where(item => item.StableElementId is not null))
        {
            var visited = new HashSet<string>(StringComparer.Ordinal);
            var current = item;
            while (current.ParentId is not null && byId.TryGetValue(current.ParentId, out current!))
                if (!visited.Add(current.StableElementId!))
                {
                    issues.Add(new(ManagerErrorCodes.RegistrationParentCycle, "Parent-Struktur enthält einen Zyklus.", item.ProposalId, "parentId"));
                    break;
                }
        }
    }
}

public static class RegistrationRegistryGenerator
{
    public static (GeneratedRegistrationRegistry? Registry, RegistrationValidationResult Validation) Create(ExistingAppAnalysis analysis)
    {
        var validation = RegistrationProposalValidator.Validate(analysis.Proposals);
        if (!validation.Success) return (null, validation);
        var elements = analysis.Proposals.Where(item => item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified)
            .OrderBy(item => item.Order).ThenBy(item => item.StableElementId, StringComparer.Ordinal)
            .Select(item => new RegistrationRegistryEntry(item.StableElementId!, item.DisplayName, item.ElementType, item.Role,
                item.ParentId, item.Order, true, item.EditorEligible == EditorEligibility.Yes, item.AllowedOps, item.LockedOps,
                item.SourceLocation, item.DeclaredName, item.StructuralPath, item.FieldKind, item.ColumnRole, item.ActionKind, item.ComponentKind)).ToArray();
        var canonical = string.Join("\n", elements.Select(item => string.Join("|", item.Id, item.ParentId ?? string.Empty,
            item.Type, item.Role, item.Order, string.Join(',', item.AllowedOps.Order(StringComparer.Ordinal)),
            string.Join(',', item.LockedOps.Order(StringComparer.Ordinal)), item.SourceLocation.RelativeFile, item.DeclaredName ?? string.Empty)));
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
        return (new(1, analysis.ApplicationId, analysis.AnalysisId, fingerprint, elements), validation);
    }
}
