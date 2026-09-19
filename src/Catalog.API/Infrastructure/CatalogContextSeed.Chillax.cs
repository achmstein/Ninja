using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.API.Infrastructure;

/// <summary>
/// Tenant one's own menu, as exported from Loyverse: the dev AppHost and the
/// E2E suite plant it (<c>Seed:Profile=chillax</c>); a stamped tenant never does.
/// </summary>
public partial class CatalogContextSeed
{
    private async Task SeedChillaxAsync(CatalogContext context)
    {
        // Seed catalog types (menu categories)
        var types = new List<CatalogType>
        {
            new(new LocalizedText("Coffee", "قهوة")) { Id = 1, DisplayOrder = 1 },
            new(new LocalizedText("Espresso", "اسبرسو")) { Id = 2, DisplayOrder = 2 },
            new(new LocalizedText("Hot Drinks", "مشروبات ساخنة")) { Id = 3, DisplayOrder = 3 },
            new(new LocalizedText("Iced Drinks", "مشروبات مثلجة")) { Id = 4, DisplayOrder = 4 },
            new(new LocalizedText("Juices", "عصائر")) { Id = 5, DisplayOrder = 5 },
            new(new LocalizedText("Soft Drinks", "مشروبات غازية")) { Id = 6, DisplayOrder = 6 },
            new(new LocalizedText("Snacks", "مقرمشات")) { Id = 7, DisplayOrder = 7 },
            new(new LocalizedText("Desserts", "حلويات")) { Id = 8, DisplayOrder = 8 }
        };

        context.CatalogTypes.RemoveRange(context.CatalogTypes);
        await context.CatalogTypes.AddRangeAsync(types);
        logger.LogInformation("Seeded catalog with {NumTypes} types", types.Count);
        await context.SaveChangesAsync();
        await ResetCategorySequenceAsync(context);

        // Seed menu items based on Loyverse export
        var menuItems = new List<CatalogItem>
        {
            // ============== COFFEE - قهوة (Category 1) ==============
            new(new LocalizedText("Turkish Coffee", "قهوة تركي"),
                new LocalizedText("Our signature Turkish coffee, roasted fresh daily", "قهوتنا التركي المميزة، محمصة طازة كل يوم"))
            {
                Price = 25.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 1,
                PictureFileName = "Turkish Coffee.jpg"
            },
            new(new LocalizedText("Hazelnut Coffee", "قهوة بندق"),
                new LocalizedText("Turkish coffee with rich hazelnut flavor", "قهوة تركي بنكهة البندق الغنية"))
            {
                Price = 35.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 2,
                PictureFileName = "Hazelnut Coffee.jpg"
            },
            new(new LocalizedText("French Coffee", "قهوة فرنساوي"),
                new LocalizedText("Smooth French-style coffee with a creamy taste", "قهوة فرنساوي ناعمة بطعم كريمي"))
            {
                Price = 35.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 3,
                PictureFileName = "French Coffee.jpg"
            },
            new(new LocalizedText("Caramel Coffee", "قهوة كاراميل"),
                new LocalizedText("Sweet caramel flavored Turkish coffee", "قهوة تركي بنكهة الكراميل الحلوة"))
            {
                Price = 30.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 4,
                PictureFileName = "Caramel Coffee.jpg"
            },
            new(new LocalizedText("Cappuccino", "كابتشينو"),
                new LocalizedText("Classic Italian cappuccino with creamy foam", "كابتشينو إيطالي كلاسيك برغوة كريمية"))
            {
                Price = 50.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 5,
                PictureFileName = "Cappuccino.jpg"
            },
            new(new LocalizedText("Latte", "لاتيه"),
                new LocalizedText("Espresso with smooth steamed milk", "اسبرسو مع حليب مبخر ناعم"))
            {
                Price = 50.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 6,
                PictureFileName = "Latte.jpg"
            },
            new(new LocalizedText("Macchiato", "ميكاتو"),
                new LocalizedText("Strong espresso with a touch of milk foam", "اسبرسو قوي بلمسة من رغوة الحليب"))
            {
                Price = 40.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 7,
                PictureFileName = "Macchiato.jpg"
            },
            new(new LocalizedText("Nescafe", "نسكافيه"),
                new LocalizedText("Instant Nescafe, black or with milk", "نسكافيه سريع التحضير، سادة أو بالحليب"))
            {
                Price = 35.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 8,
                PictureFileName = "Nescafe.jpg"
            },
            new(new LocalizedText("American Coffee", "امريكان كوفي"),
                new LocalizedText("Classic American brewed coffee", "قهوة أمريكان كلاسيك"))
            {
                Price = 60.00m,
                CatalogTypeId = 1,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 9,
                PictureFileName = "American Coffee.jpg"
            },

            // ============== ESPRESSO - اسبرسو (Category 2) ==============
            new(new LocalizedText("Espresso", "اسبرسو"),
                new LocalizedText("Strong Italian espresso shot", "شوت اسبرسو إيطالي قوي"))
            {
                Price = 35.00m,
                CatalogTypeId = 2,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 1,
                PictureFileName = "Espresso.jpg"
            },
            new(new LocalizedText("Mocha", "موكا"),
                new LocalizedText("Espresso with chocolate and steamed milk", "اسبرسو بالشوكولاتة والحليب"))
            {
                Price = 60.00m,
                CatalogTypeId = 2,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 2,
                PictureFileName = "Mocha.jpg"
            },
            new(new LocalizedText("Iced Mocha", "آيس موكا"),
                new LocalizedText("Chilled mocha with ice, perfect for hot days", "موكا ساقعة بالتلج، مثالية للأيام الحر"))
            {
                Price = 60.00m,
                CatalogTypeId = 2,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 3,
                PictureFileName = "Iced Mocha.jpg"
            },

            // ============== HOT DRINKS - مشروبات ساخنة (Category 3) ==============
            new(new LocalizedText("Tea", "شاي"),
                new LocalizedText("Traditional Egyptian tea, the way you like it", "شاي مصري تقليدي، زي ما بتحبه"))
            {
                Price = 15.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 1,
                PictureFileName = "Tea.jpg"
            },
            new(new LocalizedText("Green Tea", "شاي اخضر"),
                new LocalizedText("Healthy green tea for a refreshing experience", "شاي أخضر صحي لتجربة منعشة"))
            {
                Price = 20.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 2,
                PictureFileName = "Green Tea.jpg"
            },
            new(new LocalizedText("Herbs", "أعشاب"),
                new LocalizedText("Soothing herbal infusion - mint, anise, hibiscus, cinnamon", "أعشاب مهدئة - نعناع، ينسون، كركديه، قرفة"))
            {
                Price = 20.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 3,
                PictureFileName = "Herbs.jpg"
            },
            new(new LocalizedText("Hot Lemon", "ليمون ساخن"),
                new LocalizedText("Warm lemon drink, with optional honey", "ليمون سخن، ممكن بالعسل"))
            {
                Price = 25.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 4,
                PictureFileName = "Hot Lemon.jpg"
            },
            new(new LocalizedText("Hot Chocolate", "هوت شوكلت"),
                new LocalizedText("Rich and creamy hot chocolate", "هوت شوكلت غنية وكريمية"))
            {
                Price = 50.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 5,
                PictureFileName = "Hot Chocolate.jpg"
            },
            new(new LocalizedText("Hot Cider", "هوت سيدر"),
                new LocalizedText("Warm apple cider to warm you up", "سيدر تفاح سخن يدفيك"))
            {
                Price = 45.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 6,
                PictureFileName = "Hot Cider.jpg"
            },
            new(new LocalizedText("Sahlab", "سحلب"),
                new LocalizedText("Traditional creamy sahlab with your choice of toppings", "سحلب تقليدي كريمي بالإضافات اللي تحبها"))
            {
                Price = 40.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 7,
                DisplayOrder = 7,
                PictureFileName = "Sahlab.jpg"
            },
            new(new LocalizedText("Hummus Al-Sham", "حمص الشام"),
                new LocalizedText("Traditional Egyptian warm chickpea drink", "حمص الشام المصري الأصيل"))
            {
                Price = 40.00m,
                CatalogTypeId = 3,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 8,
                PictureFileName = "Hummus Al-Sham.jpg"
            },

            // ============== ICED DRINKS - مشروبات مثلجة (Category 4) ==============
            new(new LocalizedText("Iced Coffee", "آيس كوفي"),
                new LocalizedText("Chilled coffee over ice, refreshing and energizing", "قهوة ساقعة بالتلج، منعشة ومنشطة"))
            {
                Price = 60.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 1,
                PictureFileName = "Iced Coffee.jpg"
            },
            new(new LocalizedText("Frappuccino", "فرابتشينو"),
                new LocalizedText("Blended iced coffee drink, smooth and delicious", "فرابتشينو مخفوق، ناعم ولذيذ"))
            {
                Price = 80.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 2,
                PictureFileName = "Frappuccino.jpg"
            },
            new(new LocalizedText("Flat White", "فلات وايت"),
                new LocalizedText("Iced flat white with velvety milk", "فلات وايت ساقع بحليب ناعم"))
            {
                Price = 80.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 3,
                PictureFileName = "Flat White.jpg"
            },
            new(new LocalizedText("Iced Chocolate", "ايس شوكلت"),
                new LocalizedText("Cold chocolate drink over ice", "شوكولاتة ساقعة بالتلج"))
            {
                Price = 60.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 4,
                PictureFileName = "Iced Chocolate.jpg"
            },
            new(new LocalizedText("Milkshake", "ميلك شيك"),
                new LocalizedText("Creamy milkshake in your favorite flavor", "ميلك شيك كريمي بنكهتك المفضلة"))
            {
                Price = 50.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 5,
                PictureFileName = "Milkshake.jpg"
            },
            new(new LocalizedText("Oreo", "اوريو"),
                new LocalizedText("Oreo cookie blended shake", "شيك أوريو مخفوق"))
            {
                Price = 60.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 6,
                PictureFileName = "Oreo.jpg"
            },
            new(new LocalizedText("Burio Shake", "بوريو"),
                new LocalizedText("Burio chocolate blended shake", "شيك بوريو شوكولاتة مخفوق"))
            {
                Price = 50.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 7,
                PictureFileName = "Burio Shake.jpg"
            },
            new(new LocalizedText("Zabadi", "زبادي"),
                new LocalizedText("Fresh yogurt drink - plain, honey, or fruit", "زبادي طازج - سادة، بالعسل، أو بالفواكه"))
            {
                Price = 35.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 3,
                DisplayOrder = 8,
                PictureFileName = "Zabadi.jpg"
            },
            new(new LocalizedText("Brownies Shake", "براونيز"),
                new LocalizedText("Chocolate brownies blended shake", "شيك براونيز شوكولاتة"))
            {
                Price = 45.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 9,
                PictureFileName = "Brownies Shake.jpg"
            },
            new(new LocalizedText("Ice Cream Scoop", "بولة ايس كريم"),
                new LocalizedText("Premium ice cream scoop", "بولة آيس كريم فاخرة"))
            {
                Price = 20.00m,
                CatalogTypeId = 4,
                IsAvailable = true,
                PreparationTimeMinutes = 2,
                DisplayOrder = 10,
                PictureFileName = "Ice Cream Scoop.jpg"
            },

            // ============== JUICES - عصائر (Category 5) ==============
            new(new LocalizedText("Orange Juice", "برتقال"),
                new LocalizedText("Freshly squeezed orange juice", "عصير برتقال طازج معصور"))
            {
                Price = 20.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 1,
                PictureFileName = "Orange.jpg"
            },
            new(new LocalizedText("Mango Juice", "مانجو"),
                new LocalizedText("Fresh mango juice, sweet and tropical", "عصير مانجو طازج، حلو ومنعش"))
            {
                Price = 50.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 2,
                PictureFileName = "Mango.jpg"
            },
            new(new LocalizedText("Strawberry Juice", "فراولة"),
                new LocalizedText("Fresh strawberry juice, plain or with milk", "عصير فراولة طازج، سادة أو بالحليب"))
            {
                Price = 50.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 3,
                PictureFileName = "Strawberry.jpg"
            },
            new(new LocalizedText("Guava Juice", "جوافة"),
                new LocalizedText("Fresh guava juice, plain or with milk", "عصير جوافة طازج، سادة أو بالحليب"))
            {
                Price = 50.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 4,
                PictureFileName = "Guava.jpg"
            },
            new(new LocalizedText("Banana Juice", "موز"),
                new LocalizedText("Creamy banana juice", "عصير موز كريمي"))
            {
                Price = 35.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 5,
                PictureFileName = "Banana.jpg"
            },
            new(new LocalizedText("Kiwi Juice", "كيوي"),
                new LocalizedText("Fresh kiwi juice, tangy and refreshing", "عصير كيوي طازج، منعش"))
            {
                Price = 50.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 6,
                PictureFileName = "Kiwi.jpg"
            },
            new(new LocalizedText("Lemonade", "ليمون"),
                new LocalizedText("Fresh lemonade, plain or with mint", "ليمونادة طازجة، سادة أو بالنعناع"))
            {
                Price = 30.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 7,
                PictureFileName = "Lemonade.jpg"
            },
            new(new LocalizedText("Watermelon Juice", "بطيخ"),
                new LocalizedText("Refreshing watermelon juice", "عصير بطيخ منعش"))
            {
                Price = 45.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 4,
                DisplayOrder = 8,
                PictureFileName = "Watermelon.jpg"
            },
            new(new LocalizedText("Prickly Pear Juice", "تين شوكي"),
                new LocalizedText("Fresh prickly pear cactus fruit juice", "عصير تين شوكي طازج"))
            {
                Price = 45.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 9,
                PictureFileName = "Prickly Pear.jpg"
            },
            new(new LocalizedText("Date Shake", "بلح"),
                new LocalizedText("Sweet date shake, plain or with milk", "شيك بلح حلو، سادة أو بالحليب"))
            {
                Price = 50.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 10,
                PictureFileName = "Date Shake.jpg"
            },
            new(new LocalizedText("Fruit Salad", "فروت سلاط"),
                new LocalizedText("Mixed fresh fruit salad", "سلطة فواكه طازجة مشكلة"))
            {
                Price = 40.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 11,
                PictureFileName = "Fruit Salad.jpg"
            },
            new(new LocalizedText("Cocktail Juice", "كوكتيل"),
                new LocalizedText("Mixed fruit cocktail juice", "عصير كوكتيل فواكه مشكل"))
            {
                Price = 60.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 12,
                PictureFileName = "Cocktail Juice.jpg"
            },
            new(new LocalizedText("Sunshine Juice", "صن شاين"),
                new LocalizedText("Refreshing sunshine blend juice", "عصير صن شاين منعش"))
            {
                Price = 50.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 13,
                PictureFileName = "Sunshine Juice.jpg"
            },
            new(new LocalizedText("Florida Juice", "فلوريدا"),
                new LocalizedText("Florida-style citrus blend juice", "عصير فلوريدا حمضيات"))
            {
                Price = 60.00m,
                CatalogTypeId = 5,
                IsAvailable = true,
                PreparationTimeMinutes = 5,
                DisplayOrder = 14,
                PictureFileName = "Florida Juice.jpg"
            },

            // ============== SOFT DRINKS - مشروبات غازية (Category 6) ==============
            new(new LocalizedText("Pepsi", "بيبسي"),
                new LocalizedText("Chilled Pepsi", "بيبسي ساقع"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 1,
                PictureFileName = "Pepsi.jpg"
            },
            new(new LocalizedText("7Up", "سفن اب"),
                new LocalizedText("Chilled 7Up", "سفن اب ساقع"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 2,
                PictureFileName = "7Up.jpg"
            },
            new(new LocalizedText("Mirinda", "ميرندا"),
                new LocalizedText("Chilled Mirinda", "ميرندا ساقع"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 3,
                PictureFileName = "Mirinda.jpg"
            },
            new(new LocalizedText("Mountain Dew", "Dew"),
                new LocalizedText("Chilled Mountain Dew", "ماونتن ديو ساقع"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 4,
                PictureFileName = "Mountain Dew.jpg"
            },
            new(new LocalizedText("Twist", "Twist"),
                new LocalizedText("Carbonated lemon drink", "تويست ليمون غازي"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 5,
                PictureFileName = "Twist Berry Coconut.jpg"
            },
            new(new LocalizedText("Schweppes Lemon", "شويبس ليمون"),
                new LocalizedText("Schweppes lemon soda", "شويبس ليمون غازي"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 6,
                PictureFileName = "Schweppes Lemon.jpg"
            },
            new(new LocalizedText("Schweppes Pomegranate", "شويبس رمان"),
                new LocalizedText("Schweppes pomegranate soda", "شويبس رمان غازي"))
            {
                Price = 20.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 7,
                PictureFileName = "Schweppes Pomegranate.jpg"
            },
            new(new LocalizedText("Schweppes Gold", "شويبس جولد"),
                new LocalizedText("Schweppes gold soda", "شويبس جولد غازي"))
            {
                Price = 20.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 8,
                PictureFileName = "Schweppes Gold.jpg"
            },
            new(new LocalizedText("Schweppes Tangerine", "شويبس يوسفي"),
                new LocalizedText("Schweppes tangerine soda", "شويبس يوسفي غازي"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 9,
                PictureFileName = "Schweppes Tangerine.jpg"
            },
            new(new LocalizedText("V7", "V7"),
                new LocalizedText("Vegetable juice blend", "عصير خضروات مشكل"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 10,
                PictureFileName = "V7.jpg"
            },
            new(new LocalizedText("V7 Apple", "V7 تفاح"),
                new LocalizedText("V7 apple juice blend", "عصير V7 تفاح"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 11,
                PictureFileName = "V7 Apple.jpg"
            },
            new(new LocalizedText("V7 Lemon", "V7 ليمون"),
                new LocalizedText("V7 lemon juice blend", "عصير V7 ليمون"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 12,
                PictureFileName = "V7 Lemon.jpg"
            },
            new(new LocalizedText("V7 Diet", "V7 دايت"),
                new LocalizedText("V7 diet juice blend", "عصير V7 دايت"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 13,
                PictureFileName = "V7 Diet.jpg"
            },
            new(new LocalizedText("Mineral Water", "مياه معدنية"),
                new LocalizedText("Bottled mineral water", "مياه معدنية معبأة"))
            {
                Price = 8.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 11,
                PictureFileName = "Mineral Water.jpg"
            },
            new(new LocalizedText("Red Bull", "Red Bull"),
                new LocalizedText("Red Bull energy drink", "ريد بول مشروب طاقة"))
            {
                Price = 65.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 12,
                PictureFileName = "Red Bull.jpg"
            },
            new(new LocalizedText("Red Bull Purple", "Red Bull بنفسجي"),
                new LocalizedText("Red Bull Purple Edition energy drink", "ريد بول بنفسجي مشروب طاقة"))
            {
                Price = 65.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 16,
                PictureFileName = "Red Bull Purple.jpg"
            },
            new(new LocalizedText("Red Bull White", "Red Bull أبيض"),
                new LocalizedText("Red Bull White Edition energy drink", "ريد بول أبيض مشروب طاقة"))
            {
                Price = 65.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 17,
                PictureFileName = "Red Bull White.jpg"
            },
            new(new LocalizedText("Red Bull Diet", "Red Bull دايت"),
                new LocalizedText("Red Bull Sugar Free energy drink", "ريد بول دايت مشروب طاقة"))
            {
                Price = 65.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 18,
                PictureFileName = "Red Bull Diet.jpg"
            },
            new(new LocalizedText("Power Horse", "Power Horse"),
                new LocalizedText("Power Horse energy drink", "باور هورس مشروب طاقة"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 13,
                PictureFileName = "Power Horse.jpg"
            },
            new(new LocalizedText("Amstel Zero", "Amstel Zero"),
                new LocalizedText("Non-alcoholic Amstel beer", "أمستل زيرو بدون كحول"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 14,
                PictureFileName = "Amstel Zero.jpg"
            },
            new(new LocalizedText("Birell", "بيريل"),
                new LocalizedText("Non-alcoholic malt beverage", "بيريل شعير بدون كحول"))
            {
                Price = 25.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 15,
                PictureFileName = "Birell.jpg"
            },
            new(new LocalizedText("Barbican Apple", "باربيكان تفاح"),
                new LocalizedText("Barbican apple flavor malt beverage", "باربيكان بنكهة التفاح"))
            {
                Price = 40.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 23,
                PictureFileName = "Barbican Apple.jpg"
            },
            new(new LocalizedText("Barbican Malt", "باربيكان شعير"),
                new LocalizedText("Barbican classic malt flavor", "باربيكان شعير كلاسيك"))
            {
                Price = 40.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 24,
                PictureFileName = "Barbican Malt.jpg"
            },
            new(new LocalizedText("Barbican Pineapple", "باربيكان أناناس"),
                new LocalizedText("Barbican pineapple flavor malt beverage", "باربيكان بنكهة الأناناس"))
            {
                Price = 40.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 25,
                PictureFileName = "Barbican Pineapple.jpg"
            },
            new(new LocalizedText("Barbican Pomegranate", "باربيكان رمان"),
                new LocalizedText("Barbican pomegranate flavor malt beverage", "باربيكان بنكهة الرمان"))
            {
                Price = 40.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 26,
                PictureFileName = "Barbican Pomegranate.jpg"
            },
            new(new LocalizedText("Barbican Raspberry", "باربيكان توت"),
                new LocalizedText("Barbican raspberry flavor malt beverage", "باربيكان بنكهة التوت"))
            {
                Price = 40.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 27,
                PictureFileName = "Barbican Raspberry.jpg"
            },
            new(new LocalizedText("Barbican Strawberry", "باربيكان فراولة"),
                new LocalizedText("Barbican strawberry flavor malt beverage", "باربيكان بنكهة الفراولة"))
            {
                Price = 40.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 28,
                PictureFileName = "Barbican Strawberry.jpg"
            },
            new(new LocalizedText("Moussy", "موسي"),
                new LocalizedText("Non-alcoholic malt beverage", "موسي شعير بدون كحول"))
            {
                Price = 30.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 17,
                PictureFileName = "Moussy.jpg"
            },
            new(new LocalizedText("Spiro Spathis", "سبيرو سباتس"),
                new LocalizedText("Classic Egyptian lemon soda", "سبيرو سباتس ليمون مصري كلاسيك"))
            {
                Price = 20.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 18,
                PictureFileName = "Spiro Spathis.jpg"
            },
            new(new LocalizedText("Double Deer", "دبل دير"),
                new LocalizedText("Double Deer carbonated drink", "دبل دير مشروب غازي"))
            {
                Price = 20.00m,
                CatalogTypeId = 6,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 19,
                PictureFileName = "Double Deer.jpg"
            },

            // ============== SNACKS - مقرمشات (Category 7) ==============
            new(new LocalizedText("Chips", "مقرمشات"),
                new LocalizedText("Assorted potato chips", "شيبسي متنوع"))
            {
                Price = 15.00m,
                CatalogTypeId = 7,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 1,
                PictureFileName = "Chips.jpg"
            },
            new(new LocalizedText("Peanuts", "سوداني"),
                new LocalizedText("Roasted peanuts", "فول سوداني محمص"))
            {
                Price = 20.00m,
                CatalogTypeId = 7,
                IsAvailable = true,
                PreparationTimeMinutes = 1,
                DisplayOrder = 2,
                PictureFileName = "Peanuts.jpg"
            },

            // ============== DESSERTS - حلويات (Category 8) ==============
            new(new LocalizedText("Waffle", "وافل"),
                new LocalizedText("Belgian waffle with your choice of toppings", "وافل بلجيكي بالإضافات اللي تحبها"))
            {
                Price = 70.00m,
                CatalogTypeId = 8,
                IsAvailable = true,
                PreparationTimeMinutes = 10,
                DisplayOrder = 1,
                PictureFileName = "Waffle.jpg"
            }
        };

        await context.CatalogItems.AddRangeAsync(menuItems);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded catalog with {NumItems} menu items", menuItems.Count);

        // Add customizations for Turkish Coffee
        var turkishCoffee = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Turkish Coffee");
        if (turkishCoffee != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Roasting", "التحميص"))
                {
                    CatalogItemId = turkishCoffee.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Light", "فاتح")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 1 },
                        new(new LocalizedText("Medium", "وسط")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 2 },
                        new(new LocalizedText("Dark", "غامق")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 3 }
                    }
                },
                new(new LocalizedText("Tahwiga", "التحويجة"))
                {
                    CatalogItemId = turkishCoffee.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 2,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Spiced", "محوج")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 }
                    }
                },
                new(new LocalizedText("Sugar Level", "السكر"))
                {
                    CatalogItemId = turkishCoffee.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 3,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 1 },
                        new(new LocalizedText("Light Sugar", "على الريحة")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("Medium Sugar", "مضبوط")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 3 },
                        new(new LocalizedText("Sweet", "زيادة")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 4 },
                        new(new LocalizedText("Extra Sweet", "مانو")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 5 }
                    }
                },
                new(new LocalizedText("Cup", "الكوباية"))
                {
                    CatalogItemId = turkishCoffee.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 4,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Cup", "كوباية")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Finjan", "فنجان")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 }
                    }
                },
                new(new LocalizedText("Size", "الحجم"))
                {
                    CatalogItemId = turkishCoffee.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 5,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Single", "سنجل")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Double", "دبل")) { PriceAdjustment = 15.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for coffees with size + coffee sugar (per CSV modifiers)
        var coffeesWithSugar = await context.CatalogItems
            .Where(i => i.Name.En == "Hazelnut Coffee" || i.Name.En == "French Coffee" ||
                       i.Name.En == "Caramel Coffee")
            .ToListAsync();

        foreach (var coffee in coffeesWithSugar)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Size", "الحجم"))
                {
                    CatalogItemId = coffee.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Single", "سنجل")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Double", "دبل")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                },
                new(new LocalizedText("Sugar Level", "السكر"))
                {
                    CatalogItemId = coffee.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 2,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("No Sugar", "من غير سكر")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 1 },
                        new(new LocalizedText("Light Sugar", "سكر خفيف")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("Regular Sugar", "سكر عادي")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 3 },
                        new(new LocalizedText("Extra Sugar", "سكر زيادة")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 4 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add size-only customizations for Espresso and Macchiato (no modifiers per CSV)
        var sizeOnlyCoffees = await context.CatalogItems
            .Where(i => i.Name.En == "Espresso" || i.Name.En == "Macchiato")
            .ToListAsync();

        foreach (var coffee in sizeOnlyCoffees)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Size", "الحجم"))
                {
                    CatalogItemId = coffee.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Single", "سنجل")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Double", "دبل")) { PriceAdjustment = coffee.Name.En == "Espresso" ? 15.00m : 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Nescafe
        var nescafe = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Nescafe");
        if (nescafe != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = nescafe.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Black", "بلاك")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Milk", "بالحليب")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Tea
        var tea = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Tea");
        if (tea != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Sugar Level", "السكر"))
                {
                    CatalogItemId = tea.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("No Sugar", "بدون سكر")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 1 },
                        new(new LocalizedText("Medium Sugar", "مضبوط")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 2 },
                        new(new LocalizedText("Sweet", "زيادة")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 3 }
                    }
                },
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = tea.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 2,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Tea Bag", "باكيت")) { PriceAdjustment = 5.00m, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Lemon", "ليمون")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("With Mint", "نعناع")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 3 },
                        new(new LocalizedText("With Milk", "حليب")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 4 }
                    }
                },
                new(new LocalizedText("Cup", "الكوباية"))
                {
                    CatalogItemId = tea.Id,
                    IsRequired = false,
                    AllowMultiple = false,
                    DisplayOrder = 3,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Regular", "كوباية عادية")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Large", "خمسينة")) { PriceAdjustment = 5.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Herbal Tea
        var herbalTea = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Herbal Tea");
        if (herbalTea != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = herbalTea.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Mint", "نعناع")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Anise", "ينسون")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("Hibiscus", "كركديه")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 3 },
                        new(new LocalizedText("Cinnamon", "قرفة")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 4 },
                        new(new LocalizedText("Cinnamon with Milk", "قرفة حليب")) { PriceAdjustment = 5.00m, IsDefault = false, DisplayOrder = 5 },
                        new(new LocalizedText("Cinnamon Ginger", "قرفة جنزبيل")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 6 },
                        new(new LocalizedText("Cocktail Mix", "كوكتيل")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 7 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Sahlab
        var sahlab = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Sahlab");
        if (sahlab != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = sahlab.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Chocolate", "شوكولاتة")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("With Nuts", "مكسرات")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 3 },
                        new(new LocalizedText("With Oreo", "اوريو")) { PriceAdjustment = 20.00m, IsDefault = false, DisplayOrder = 4 },
                        new(new LocalizedText("With Burio", "بوريو")) { PriceAdjustment = 20.00m, IsDefault = false, DisplayOrder = 5 },
                        new(new LocalizedText("With Fruits", "فواكه")) { PriceAdjustment = 25.00m, IsDefault = false, DisplayOrder = 6 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Hot Lemon
        var hotLemon = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Hot Lemon");
        if (hotLemon != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = hotLemon.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Honey", "عسل")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Milkshake
        var milkshake = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Milkshake");
        if (milkshake != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Flavor", "النكهة"))
                {
                    CatalogItemId = milkshake.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Chocolate", "شيكولاته")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("Vanilla", "فانيليا")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("Caramel", "كراميل")) { PriceAdjustment = 0, IsDefault = false, DisplayOrder = 3 },
                        new(new LocalizedText("Oreo", "أوريو")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 4 },
                        new(new LocalizedText("Strawberry", "فراولة")) { PriceAdjustment = 20.00m, IsDefault = false, DisplayOrder = 5 },
                        new(new LocalizedText("Galaxy", "جالاكسي")) { PriceAdjustment = 30.00m, IsDefault = false, DisplayOrder = 6 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Oreo and Burio shakes
        var shakes = await context.CatalogItems
            .Where(i => i.Name.En == "Oreo Shake" || i.Name.En == "Burio Shake")
            .ToListAsync();

        foreach (var shake in shakes)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = shake.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Chunks", "قطع")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Yogurt
        var yogurt = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Yogurt");
        if (yogurt != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = yogurt.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Honey", "عسل")) { PriceAdjustment = 5.00m, IsDefault = false, DisplayOrder = 2 },
                        new(new LocalizedText("With Fruits", "فواكه")) { PriceAdjustment = 30.00m, IsDefault = false, DisplayOrder = 3 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for juices with milk option
        var juicesWithMilk = await context.CatalogItems
            .Where(i => i.Name.En == "Strawberry Juice" || i.Name.En == "Guava Juice" || i.Name.En == "Date Shake")
            .ToListAsync();

        foreach (var juice in juicesWithMilk)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = juice.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Milk", "حليب")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        // Add customizations for Lemonade
        var lemonade = await context.CatalogItems.FirstOrDefaultAsync(i => i.Name.En == "Lemonade");
        if (lemonade != null)
        {
            var customizations = new List<ItemCustomization>
            {
                new(new LocalizedText("Type", "النوع"))
                {
                    CatalogItemId = lemonade.Id,
                    IsRequired = true,
                    AllowMultiple = false,
                    DisplayOrder = 1,
                    Options = new List<CustomizationOption>
                    {
                        new(new LocalizedText("Plain", "سادة")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                        new(new LocalizedText("With Mint", "نعناع")) { PriceAdjustment = 10.00m, IsDefault = false, DisplayOrder = 2 }
                    }
                }
            };
            await context.ItemCustomizations.AddRangeAsync(customizations);
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Seeded customizations for menu items");
    }
}
