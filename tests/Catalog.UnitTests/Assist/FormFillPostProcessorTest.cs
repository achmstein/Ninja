using Ninja.Catalog.API.Assist;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class FormFillPostProcessorTest
{
    private static FillFormRequest Supplier(string? languages = null) => new(
        "a supplier",
        [
            new FormField("name.en", "Name (English)", FormFieldType.Text, "Cairo Dairy", Language: "en"),
            new FormField("name.ar", "Name (Arabic)", FormFieldType.Text, Language: "ar"),
            new FormField("notes", "Notes", FormFieldType.LongText),
            new FormField("phone", "Phone", FormFieldType.Text, "01000000000"),
            new FormField("category", "Category", FormFieldType.Choice, Options: [new("dairy", "Dairy"), new("meat", "Meat")]),
            new FormField("credit", "Credit days", FormFieldType.Number),
            new FormField("active", "Active", FormFieldType.YesNo),
        ],
        languages);

    [TestMethod]
    public void Only_empty_fields_are_offered_to_the_model()
    {
        CollectionAssert.AreEqual(
            new[] { "name.ar", "notes", "category", "credit", "active" },
            FormFillPostProcessor.FieldsToFill(Supplier()).ToList());
    }

    [TestMethod]
    public void A_language_the_business_does_not_write_is_left_alone()
    {
        Assert.DoesNotContain("name.ar", FormFillPostProcessor.FieldsToFill(Supplier("en")).ToList());
    }

    [TestMethod]
    public void Keeps_valid_answers_and_drops_the_rest()
    {
        var result = new FillFormResult(
        [
            new("name.ar", "  ألبان القاهرة "),
            new("phone", "01111111111"),
            new("category", "fish"),
            new("credit", "abc"),
            new("active", "Yes"),
            new("name.ar", "مكرر"),
            new("unknown", "x"),
        ], string.Empty);

        var response = FormFillPostProcessor.Apply(Supplier(), result);

        CollectionAssert.AreEqual(
            new[] { "name.ar=ألبان القاهرة", "active=true" },
            response.Values.Select(v => $"{v.Key}={v.Value}").ToList(),
            "a filled field, an option not offered, a non-number, a repeat and an unknown key are all dropped");
        Assert.IsEmpty(response.Warnings);
    }

    [TestMethod]
    public void A_choice_must_be_one_of_its_options()
    {
        var response = FormFillPostProcessor.Apply(Supplier(), new FillFormResult([new("category", "dairy")], string.Empty));

        Assert.AreEqual("dairy", response.Values.Single().Value);
    }

    [TestMethod]
    public void Long_text_is_capped()
    {
        var response = FormFillPostProcessor.Apply(
            Supplier(),
            new FillFormResult([new("notes", new string('x', FormFillPostProcessor.MaxLongTextLength + 50))], string.Empty));

        Assert.AreEqual(FormFillPostProcessor.MaxLongTextLength, response.Values.Single().Value.Length);
    }

    [TestMethod]
    public void A_form_with_nothing_typed_is_refused()
    {
        var empty = new FillFormRequest("a supplier", [new FormField("name.en", "Name", FormFieldType.Text)]);

        Assert.IsNotNull(FormFillPostProcessor.Validate(empty));
    }

    [TestMethod]
    public void A_choice_without_options_is_refused()
    {
        var request = new FillFormRequest("a supplier",
        [
            new FormField("name.en", "Name", FormFieldType.Text, "Cairo Dairy"),
            new FormField("category", "Category", FormFieldType.Choice),
        ]);

        Assert.IsNotNull(FormFillPostProcessor.Validate(request));
    }

    [TestMethod]
    public void A_good_request_passes()
    {
        Assert.IsNull(FormFillPostProcessor.Validate(Supplier()));
    }
}
