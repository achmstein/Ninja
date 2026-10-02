using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.UnitTests;

[TestClass]
public class DishPhotosTests
{
    [TestMethod]
    public void A_dish_is_drawn_by_both_its_names_and_what_it_is_in_the_house_studio_style()
    {
        var prompt = DishPhotos.PromptFor("Koshari", "كشري", "rice, lentils and pasta under spiced tomato sauce", "Mains");
        StringAssert.Contains(prompt, "Koshari (كشري)");
        StringAssert.Contains(prompt, "It is: rice, lentils and pasta under spiced tomato sauce.");
        StringAssert.Contains(prompt, "menu's Mains");
        StringAssert.Contains(prompt, "plain light surface");
        StringAssert.Contains(prompt, "No text");
    }

    [TestMethod]
    public void A_dish_named_in_one_language_is_drawn_by_that_name()
    {
        StringAssert.Contains(DishPhotos.PromptFor(null, "فول", null, null), "photograph of فول,");
        Assert.IsFalse(DishPhotos.PromptFor("Tea", null, null, null).Contains("It is:"), "no description, no sentence for it");
    }

    [TestMethod]
    public void Drawing_runs_in_its_own_lane_and_never_holds_a_stamp_or_a_backup()
    {
        Assert.AreEqual(JobLane.Ai, ProvisioningJob.LaneOf("photos"));
        Assert.AreEqual(JobLane.Stamp, ProvisioningJob.LaneOf("provision"));
        Assert.AreEqual(JobLane.Backup, ProvisioningJob.LaneOf("backup"));
    }
}
