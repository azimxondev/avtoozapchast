"""
Avto Sklad — Realistic 100+ Automotive Products Seed Data & Transactions
"""

import time
from app.database.db import db
from app.config import INITIAL_BUDGET, HEAD_ADMIN_ID

CATEGORIES = [
    {"name": "Shinalar & Balonlar", "slug": "tires", "icon": "tire", "description": "Yengil va yuk avtomobillari uchun shinalar", "sort_order": 1},
    {"name": "Kuzov Qismlari", "slug": "body-parts", "icon": "body", "description": "Bamper, kapot, qanot, eshiklar, panjaralar", "sort_order": 2},
    {"name": "Avto Oynalar", "slug": "glass", "icon": "glass", "description": "Old, orqa va yon oynalar", "sort_order": 3},
    {"name": "Dvigatel Qismlari", "slug": "engine", "icon": "engine", "description": "Porshen, klapan, podshipnik, svecha, starter", "sort_order": 4},
    {"name": "Xodovoy & Podveska", "slug": "suspension", "icon": "suspension", "description": "Amortizator, richag, prujina, sharavoy, tyaga", "sort_order": 5},
    {"name": "Tormoz Tizimi", "slug": "brakes", "icon": "brakes", "description": "Kolodkalar, disklar, support, tormoz shlanglari", "sort_order": 6},
    {"name": "Elektronika & Faralar", "slug": "electrical", "icon": "lighting", "description": "Faralar, stoplar, datchiklar, generator", "sort_order": 7},
    {"name": "Sovutish Tizimi", "slug": "cooling", "icon": "cooling", "description": "Radiator, pompa, termostat, patrubkalar", "sort_order": 8},
    {"name": "Filtrlar & Moylar", "slug": "filters", "icon": "filters", "description": "Moy, havo, salon va yonilg'i filtrlari", "sort_order": 9},
    {"name": "Transmissiya", "slug": "transmission", "icon": "transmission", "description": "Ssepleniye, korobka qismlari, granata", "sort_order": 10},
    {"name": "Aksessuarlar", "slug": "accessories", "icon": "accessories", "description": "Kovriklar, deflektorlar, chexollar", "sort_order": 11}
]

# Helper to generate 105 realistic automotive products
def get_105_products():
    raw_products = [
        # --- SHINALAR (10) ---
        ("Michelin Primacy 4 205/55 R16", "TIRE-MICH-2055516", "tires", "Michelin", "Chevrolet", "Gentra, Cobalt, Lacetti", "2010-2024", "Fransuz brendi yozgi shina", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 950000, 1250000, 12, 4, "dona", "S-01"),
        ("Pirelli Cinturato P7 215/55 R17", "TIRE-PIR-2155517", "tires", "Pirelli", "Chevrolet", "Malibu 2, Tracker 2", "2017-2024", "Italiya premium shinalari", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 1200000, 1550000, 8, 2, "dona", "S-02"),
        ("Kumho Ecwing ES31 185/65 R15", "TIRE-KUM-1856515", "tires", "Kumho", "Chevrolet", "Cobalt, Nexia 3", "2013-2024", "Koreys yumshoq shinalari", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 520000, 720000, 16, 4, "dona", "S-03"),
        ("Charmhoo 175/70 R13 Damas", "TIRE-CHM-1757013", "tires", "Charmhoo", "Chevrolet", "Damas, Labo", "1996-2024", "Mustahkam 8 qavatli karkas", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 380000, 510000, 24, 6, "dona", "S-04"),
        ("Nexen N'Fera SU1 225/50 R18", "TIRE-NXN-2255018", "tires", "Nexen", "Chevrolet", "Malibu 2 Premier", "2018-2024", "Yuqori tezlikka mos sport shina", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 1450000, 1900000, 4, 2, "dona", "S-05"),
        ("Hankook Kinergy Eco 195/65 R15", "TIRE-HNK-1956515", "tires", "Hankook", "Chevrolet", "Gentra, Cobalt", "2010-2024", "Yoqilg'i tejamkor yozgi shina", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 650000, 860000, 0, 2, "dona", "S-06"), # OUT OF STOCK
        ("Continental ContiPremiumContact 205/60 R16", "TIRE-CNT-2056016", "tires", "Continental", "Chevrolet", "Tracker, Tracker 2", "2019-2024", "Nemis sifati, xavfsiz tormoz", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 1100000, 1450000, 1, 2, "dona", "S-07"), # LOW STOCK
        ("BridgeStone Turanza T005 215/60 R16", "TIRE-BS-2156016", "tires", "Bridgestone", "Chevrolet", "Malibu 1, Epica", "2010-2020", "Yapon mustahkam shinalari", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 1050000, 1380000, 6, 2, "dona", "S-08"),
        ("Roadstone CP672 185/70 R14", "TIRE-RDS-1857014", "tires", "Roadstone", "Chevrolet", "Nexia 1, Nexia 2, Spark", "1996-2016", "Shaharga mos chidamli shina", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 440000, 600000, 10, 3, "dona", "S-09"),
        ("Dunlop SP Sport FM800 205/55 R16", "TIRE-DNL-2055516", "tires", "Dunlop", "Chevrolet", "Lacetti, Gentra", "2005-2024", "Yomg'irda sirpanmaydigan protektor", "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600", "NEW", 750000, 990000, 8, 2, "dona", "S-10"),

        # --- KUZOV QISMLARI (15) ---
        ("Cobalt Old Bamper (GM Original)", "BUMP-COB-F01", "body-parts", "GM Genuine", "Chevrolet", "Cobalt", "2013-2024", "Zavod gruntlangan old bamper", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 420000, 600000, 6, 2, "dona", "K-01"),
        ("Gentra Kapot (Original Zavod)", "BODY-GEN-KPT", "body-parts", "GM Genuine", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Zavod ruxlangan metall kapot", "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600", "NEW", 1100000, 1450000, 3, 1, "dona", "K-02"),
        ("Nexia 3 Old Chap Qanot (Krilo)", "BODY-NEX3-WING-L", "body-parts", "GM Genuine", "Chevrolet", "Nexia 3", "2016-2023", "Zavod original chap qanot", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 430000, 590000, 1, 2, "dona", "K-03"), # LOW STOCK
        ("Nexia 3 Old O'ng Qanot (Krilo)", "BODY-NEX3-WING-R", "body-parts", "GM Genuine", "Chevrolet", "Nexia 3", "2016-2023", "Zavod original o'ng qanot", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 430000, 590000, 0, 2, "dona", "K-03"), # OUT OF STOCK
        ("Onix Old Bamper Panjarasi (Gril)", "BUMP-ONX-GRIL", "body-parts", "GM Genuine", "Chevrolet", "Onix Premier", "2022-2024", "Xrom va yaltiroq qora panjara", "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600", "NEW", 310000, 460000, 4, 2, "dona", "K-04"),
        ("Tracker 2 Orqa Bamper", "BUMP-TRK2-R01", "body-parts", "GM Genuine", "Chevrolet", "Tracker 2", "2021-2024", "Original qora difuzorli bamper", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 850000, 1150000, 3, 1, "dona", "K-05"),
        ("Cobalt Orqa Bamper (GM Zavod)", "BUMP-COB-R01", "body-parts", "GM Genuine", "Chevrolet", "Cobalt", "2013-2024", "Original orqa bamper", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 390000, 550000, 5, 2, "dona", "K-06"),
        ("Gentra Old Bamper (Tumanka joyli)", "BUMP-GEN-F02", "body-parts", "UzAuto Parts", "Chevrolet", "Gentra", "2013-2024", "Gruntlangan old bamper", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 410000, 580000, 4, 2, "dona", "K-07"),
        ("Cobalt Yon Ko'zgusi (Elektr, Chap)", "BODY-COB-MRR-L", "body-parts", "UzAuto Parts", "Chevrolet", "Cobalt", "2013-2024", "Qizdirgichli elektr sozlanuvchi ko'zgu", "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600", "NEW", 260000, 370000, 4, 2, "dona", "K-08"),
        ("Cobalt Yon Ko'zgusi (Elektr, O'ng)", "BODY-COB-MRR-R", "body-parts", "UzAuto Parts", "Chevrolet", "Cobalt", "2013-2024", "Qizdirgichli elektr sozlanuvchi ko'zgu", "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600", "NEW", 260000, 370000, 5, 2, "dona", "K-08"),
        ("Spark Old Bamper (2-pozitsiya)", "BUMP-SPK-F01", "body-parts", "UzAuto Parts", "Chevrolet", "Spark", "2010-2022", "Gruntlangan original old bamper", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 280000, 410000, 6, 2, "dona", "K-09"),
        ("Malibu 2 Oldi Bamper Pastki Lip", "BUMP-MAL2-LIP", "body-parts", "GM Genuine", "Chevrolet", "Malibu 2", "2017-2023", "Qora aerodinamik pastki yubka", "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600", "NEW", 350000, 520000, 3, 1, "dona", "K-10"),
        ("Gentra Podkrilnik Oldi Chap", "BODY-GEN-LNR-L", "body-parts", "UzAuto Parts", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Zavod plastik g'ildirak arkasi himoyasi", "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600", "NEW", 85000, 135000, 15, 4, "dona", "K-11"),
        ("Damas Old Bamper Temir Quvuri", "BUMP-DAM-BAR", "body-parts", "UzAuto Parts", "Chevrolet", "Damas, Labo", "1996-2024", "Zavod karkas bamperi", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600", "NEW", 160000, 240000, 8, 2, "dona", "K-12"),
        ("Tracker 2 Kapot (Original GM)", "BODY-TRK2-KPT", "body-parts", "GM Genuine", "Chevrolet", "Tracker 2", "2021-2024", "Alyumin yengil original kapot", "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600", "NEW", 1850000, 2400000, 2, 1, "dona", "K-13"),

        # --- AVTO OYNALAR (8) ---
        ("Gentra Oldi Oyna (Xameleon 5%)", "GLS-GEN-F02", "glass", "Autoglass Uz", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Issiqlik qaytaruvchi laminat oyna", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 650000, 900000, 4, 2, "dona", "O-01"),
        ("Cobalt Oldi Oyna (GM Original)", "GLS-COB-F01", "glass", "GM Genuine", "Chevrolet", "Cobalt", "2013-2024", "Zavod tripleks old oynasi", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 580000, 820000, 5, 2, "dona", "O-02"),
        ("Nexia 3 Oldi Oyna (Original UzAuto)", "GLS-NEX3-F01", "glass", "UzAuto Parts", "Chevrolet", "Nexia 3", "2016-2023", "Shovqindan himoyalovchi tripleks", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 490000, 710000, 3, 2, "dona", "O-03"),
        ("Malibu 2 Old Oyna Datchik Joyli", "GLS-MAL2-F01", "glass", "Fuyao", "Chevrolet", "Malibu 2", "2017-2023", "Yomg'ir va chiziq datchigi joyli premium oyna", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 1400000, 1950000, 2, 1, "dona", "O-04"),
        ("Tracker 2 Old Oyna", "GLS-TRK2-F01", "glass", "Fuyao", "Chevrolet", "Tracker 2", "2021-2024", "Kamera va distansiya datchikli", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 1250000, 1750000, 2, 1, "dona", "O-05"),
        ("Cobalt Orqa Oyna Qizdirgichli", "GLS-COB-R01", "glass", "UzAuto Parts", "Chevrolet", "Cobalt", "2013-2024", "Elektr qizdirish iplari bor orqa oyna", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 420000, 620000, 4, 2, "dona", "O-06"),
        ("Spark Old Oyna (Zavod)", "GLS-SPK-F01", "glass", "UzAuto Parts", "Chevrolet", "Spark", "2010-2022", "Kompakt shahar avtosi old oynasi", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 380000, 540000, 6, 2, "dona", "O-07"),
        ("Damas Old Oyna Rezinali", "GLS-DAM-F01", "glass", "UzAuto Parts", "Chevrolet", "Damas, Labo", "1996-2024", "Zavod tripleks old oyna", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600", "NEW", 280000, 420000, 8, 2, "dona", "O-08"),

        # --- DVIGATEL QISMLARI (12) ---
        ("Cobalt Svecha To'plami NGK Iridium", "ENG-COB-NGK4", "engine", "NGK Japan", "Chevrolet", "Cobalt, Gentra 1.5", "2013-2024", "100,000 km xizmat muddati", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 160000, 240000, 15, 4, "to'plam", "D-01"),
        ("Gentra Benzonasos (Bosch Original)", "ENG-GEN-PUMP", "engine", "Bosch", "Chevrolet", "Gentra, Nexia 3, Cobalt", "2008-2024", "3.8 bar yuqori bosimli motorchik", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 280000, 390000, 9, 3, "dona", "D-02"),
        ("Cobalt Starter (Delphi Original)", "ENG-COB-STRT", "engine", "Delphi", "Chevrolet", "Cobalt", "2013-2024", "Kuchli reduktorli starter", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 850000, 1150000, 2, 2, "dona", "D-03"),
        ("Spark Dinamo Generator (Delphi 85A)", "ENG-SPK-GEN", "engine", "Delphi", "Chevrolet", "Spark 1.25", "2010-2022", "85 Amper original generator", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 720000, 980000, 3, 1, "dona", "D-04"),
        ("Gentra Porshen To'plami Koltsolari Bilan (Standard)", "ENG-GEN-PIST", "engine", "GM Genuine", "Chevrolet", "Gentra, Lacetti 1.5", "2013-2024", "Zavod 1.5 DOHC dvigatel uchun", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 650000, 920000, 4, 2, "to'plam", "D-05"),
        ("Nexia 3 Dvigatel Remeni (Gates PowerGrip)", "ENG-NEX3-BELT", "engine", "Gates", "Chevrolet", "Nexia 3 1.5", "2016-2023", "Yuqori chidamli poliklinoviy remen", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 95000, 145000, 18, 4, "dona", "D-06"),
        ("Tracker 2 Zanjir To'plami (GRM Chain Kit)", "ENG-TRK2-CHAIN", "engine", "GM Genuine", "Chevrolet", "Tracker 2, Onix 1.2 Turbo", "2021-2024", "Zanjir, natyajitel va bashmaklar", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 1250000, 1700000, 3, 1, "to'plam", "D-07"),
        ("Malibu 2 Dvigatel Yostiqchasi (Poddushka, Oldi)", "ENG-MAL2-MNT", "engine", "GM Genuine", "Chevrolet", "Malibu 2 1.5T", "2017-2023", "Gidravlik tebranish so'ndirgich", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 580000, 810000, 4, 2, "dona", "D-08"),
        ("Cobalt Klapan Qopqog'i Prokladkasi", "ENG-COB-GSKT", "engine", "Victor Reinz", "Chevrolet", "Cobalt 1.5", "2013-2024", "Germaniya sifatli silikon rezina", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 45000, 75000, 25, 5, "dona", "D-09"),
        ("Gentra Babina (Zajiganiye Katushkasi)", "ENG-GEN-COIL", "engine", "Delphi", "Chevrolet", "Gentra, Cobalt", "2013-2024", "Original uchqun katushkasi", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 210000, 310000, 10, 3, "dona", "D-10"),
        ("Damas Karbyurator Yangi Rusumi", "ENG-DAM-CARB", "engine", "Daehan", "Chevrolet", "Damas 0.8", "1996-2015", "Koreya sozlamali karbyurator", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 480000, 690000, 5, 2, "dona", "D-11"),
        ("Cobalt Dvigatel Moy Nasosi (Maslonasos)", "ENG-COB-OPUMP", "engine", "GM Genuine", "Chevrolet", "Cobalt 1.5", "2013-2024", "Zavod yog' bosim nasosi", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 450000, 650000, 3, 2, "dona", "D-12"),

        # --- XODOVOY & PODVESKA (12) ---
        ("Gentra Amortizator Old Chap (KYB Excel-G)", "SUSP-GEN-KYB-L", "suspension", "Kayaba (KYB)", "Chevrolet", "Gentra, Lacetti", "2005-2024", "Gaz-moyli qulay amortizator", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 420000, 580000, 7, 2, "dona", "X-01"),
        ("Gentra Amortizator Old O'ng (KYB Excel-G)", "SUSP-GEN-KYB-R", "suspension", "Kayaba (KYB)", "Chevrolet", "Gentra, Lacetti", "2005-2024", "Gaz-moyli qulay amortizator", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 420000, 580000, 6, 2, "dona", "X-01"),
        ("Cobalt Old Amortizator To'plami (Mando)", "SUSP-COB-MND", "suspension", "Mando Korea", "Chevrolet", "Cobalt", "2013-2024", "Koreys gaz-moy amortizatorlari", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 780000, 1050000, 5, 2, "to'plam", "X-02"),
        ("Tracker 2 Old Amortizator (GM Original)", "SUSP-TRK2-F01", "suspension", "GM Genuine", "Chevrolet", "Tracker 2", "2021-2024", "Original silliq harakat amortizatori", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 920000, 1280000, 3, 1, "dona", "X-03"),
        ("Damas Old Resor Quloqlari To'plami", "SUSP-DAM-RESR", "suspension", "UzAuto Parts", "Chevrolet", "Damas, Labo", "1996-2024", "Mustahkam po'lat va rezinalar", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 95000, 145000, 11, 3, "to'plam", "X-04"),
        ("Lacetti Rul Tyagasi (CTR Korea)", "SUSP-LAC-TIE", "suspension", "CTR", "Chevrolet", "Lacetti, Gentra", "2003-2024", "Koreys sifatidagi rul tortqisi", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 85000, 130000, 10, 3, "dona", "X-05"),
        ("Cobalt Sharavoy Opora (CTR Korea)", "SUSP-COB-BALL", "suspension", "CTR", "Chevrolet", "Cobalt", "2013-2024", "Og'ir yukka chidamli sharavoy", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 65000, 98000, 16, 4, "dona", "X-06"),
        ("Nexia 3 Rul Reykasi (Original Gidravlika)", "SUSP-NEX3-RACK", "suspension", "UzAuto Parts", "Chevrolet", "Nexia 3", "2016-2023", "Gidrokuchaytirgichli rul reykasi", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 1150000, 1600000, 2, 1, "dona", "X-07"),
        ("Malibu 2 Orqa Richag To'plami", "SUSP-MAL2-ARM", "suspension", "GM Genuine", "Chevrolet", "Malibu 2", "2017-2023", "Alyumin ko'p bo'g'inli podveska richaglari", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 850000, 1200000, 3, 1, "to'plam", "X-08"),
        ("Spark Old Prujina (Zavod)", "SUSP-SPK-SPRG", "suspension", "UzAuto Parts", "Chevrolet", "Spark", "2010-2022", "Standart balandlikdagi po'lat prujina", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 120000, 175000, 8, 2, "dona", "X-09"),
        ("Cobalt Stupitsa Podshipnik (Oldi, SKF)", "SUSP-COB-BRG", "suspension", "SKF", "Chevrolet", "Cobalt ABS", "2013-2024", "Shvetsiya sifatidagi ABS podshipnik", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 185000, 270000, 12, 3, "dona", "X-10"),
        ("Gentra Stabilizator Stoykasi (CTR)", "SUSP-GEN-STAB", "suspension", "CTR", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Old stabilizator tyagasi", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600", "NEW", 55000, 85000, 20, 5, "dona", "X-11"),

        # --- TORMOZ TIZIMI (10) ---
        ("Malibu 2 Tormoz Kolodkasi (Oldi, Brembo)", "BRK-MAL2-FBRM", "brakes", "Brembo", "Chevrolet", "Malibu 2", "2017-2023", "Keramika kompozit tormoz kolodkasi", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 380000, 550000, 8, 3, "to'plam", "T-01"),
        ("Spark Old Tormoz Kolodkasi (Hi-Q Sangsin)", "BRK-SPK-HIQ", "brakes", "Sangsin (Hi-Q)", "Chevrolet", "Spark", "2010-2022", "Koreys yumshoq shovqinsiz kolodkasi", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 110000, 165000, 14, 4, "to'plam", "T-02"),
        ("Cobalt Tormoz Diski Oldi (Ferodo)", "BRK-COB-ROTOR", "brakes", "Ferodo", "Chevrolet", "Cobalt", "2013-2024", "Ventilyatsiyali yuqori sifatli tormoz diski", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 280000, 420000, 8, 2, "to'plam", "T-03"),
        ("Gentra Old Tormoz Kolodkasi (Zimmermann)", "BRK-GEN-ZIM", "brakes", "Zimmermann", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Nemis sifati, diskni yemirmaydi", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 190000, 280000, 10, 3, "to'plam", "T-04"),
        ("Nexia 3 Tormoz Kolodkasi (Hi-Q Korea)", "BRK-NEX3-HIQ", "brakes", "Sangsin (Hi-Q)", "Chevrolet", "Nexia 3", "2016-2023", "Ishonchli tormozlash", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 125000, 185000, 12, 4, "to'plam", "T-05"),
        ("Tracker 2 Tormoz Disklari (Oldi, GM)", "BRK-TRK2-ROTOR", "brakes", "GM Genuine", "Chevrolet", "Tracker 2, Onix", "2021-2024", "Original ventilyatsiyali diski", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 650000, 920000, 4, 2, "to'plam", "T-06"),
        ("Cobalt Tormoz Bosh Silindri (Vakuumli)", "BRK-COB-CYL", "brakes", "Mando", "Chevrolet", "Cobalt ABS", "2013-2024", "Gidravlik tormoz tsilindri", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 410000, 590000, 3, 1, "dona", "T-07"),
        ("Brembo DOT 4 Tormoz Suyuqligi (1L)", "BRK-DOT4-1L", "brakes", "Brembo", "Universal", "Barcha avtomobillar", "2010-2024", "260°C qaynash haroratli suyuqlik", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 75000, 115000, 30, 6, "dona", "T-08"),
        ("Damas Orqa Tormoz Kolodkalari (Barabanli)", "BRK-DAM-R01", "brakes", "UzAuto Parts", "Chevrolet", "Damas, Labo", "1996-2024", "Mustahkam friksion qoplamali", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 85000, 130000, 14, 4, "to'plam", "T-09"),
        ("Gentra Qo'l Tormozi Trosi (Ruchnik Tros)", "BRK-GEN-CBL", "brakes", "UzAuto Parts", "Chevrolet", "Gentra", "2013-2024", "Zavod po'lat trosi", "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600", "NEW", 75000, 120000, 8, 2, "dona", "T-10"),

        # --- ELEKTRONIKA & FARALAR (12) ---
        ("Nexia 3 Old Fara LED Lupa (Chap)", "LIGHT-NEX3-L01", "electrical", "UzAuto Parts", "Chevrolet", "Nexia 3", "2016-2023", "Original chap fara lupali", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 550000, 780000, 5, 2, "dona", "E-01"),
        ("Nexia 3 Old Fara LED Lupa (O'ng)", "LIGHT-NEX3-R01", "electrical", "UzAuto Parts", "Chevrolet", "Nexia 3", "2016-2023", "Original o'ng fara lupali", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 550000, 780000, 4, 2, "dona", "E-01"),
        ("Tracker 2 To'liq LED Fara (Chap)", "LIGHT-TRK2-FLED", "electrical", "GM Genuine", "Chevrolet", "Tracker 2 Redline", "2021-2024", "Original Full LED fara", "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600", "NEW", 2400000, 3200000, 2, 1, "dona", "E-02"),
        ("Gentra Orqa Fara Stop (O'ng)", "LIGHT-GEN-STOP-R", "electrical", "GM Genuine", "Chevrolet", "Gentra", "2013-2024", "Original orqa stop chirog'i", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 410000, 580000, 3, 2, "dona", "E-03"),
        ("Gentra Orqa Fara Stop (Chap)", "LIGHT-GEN-STOP-L", "electrical", "GM Genuine", "Chevrolet", "Gentra", "2013-2024", "Original orqa stop chirog'i", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 410000, 580000, 4, 2, "dona", "E-03"),
        ("Cobalt Old Fara (Original GM)", "LIGHT-COB-F01", "electrical", "GM Genuine", "Chevrolet", "Cobalt", "2013-2024", "Zavod xrom korpusli old fara", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 480000, 680000, 6, 2, "dona", "E-04"),
        ("Cobalt Tumanka Fara To'plami (LED)", "LIGHT-COB-FOG", "electrical", "Sal-Man", "Chevrolet", "Cobalt", "2013-2024", "Ikki rejimli oq va sariq LED tumanka", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 240000, 360000, 8, 3, "to'plam", "E-05"),
        ("Malibu 2 Orqa LED Stop Chiroqlari", "LIGHT-MAL2-STOP", "electrical", "GM Genuine", "Chevrolet", "Malibu 2", "2017-2023", "Original chiziqli LED orqa chiroq", "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600", "NEW", 1200000, 1650000, 2, 1, "to'plam", "E-06"),
        ("Spark Old Fara (Original)", "LIGHT-SPK-F01", "electrical", "UzAuto Parts", "Chevrolet", "Spark", "2010-2022", "Katta shaffof linzali old fara", "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600", "NEW", 360000, 510000, 5, 2, "dona", "E-07"),
        ("Cobalt Generator Rele Regulyatori", "ELEC-COB-REG", "electrical", "Delphi", "Chevrolet", "Cobalt 1.5", "2013-2024", "Zaryadkashokka qarshi kuchlanish rele", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 95000, 145000, 10, 3, "dona", "E-08"),
        ("Gentra Raspredval Datchigi (CMP Sensor)", "ELEC-GEN-CMP", "electrical", "Bosch", "Chevrolet", "Gentra", "2008-2024", "Original fazalar datchigi", "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600", "NEW", 110000, 165000, 7, 2, "dona", "E-09"),
        ("Tracker 2 Parkovka Datchigi (Pardtronik)", "ELEC-TRK2-PRK", "electrical", "GM Genuine", "Chevrolet", "Tracker 2, Onix", "2021-2024", "Original ultratovushli datchik", "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=600", "NEW", 140000, 210000, 12, 3, "dona", "E-10"),

        # --- SOVUTISH TIZIMI (8) ---
        ("Cobalt Radiator Asosiy (Hanon Systems)", "COOL-COB-RAD", "cooling", "Hanon Systems", "Chevrolet", "Cobalt", "2013-2024", "Zavod alyumin naychali sovutish radiatori", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 520000, 720000, 3, 2, "dona", "R-01"),
        ("Gentra Asosiy Radiator (Mexanika)", "COOL-GEN-RAD-M", "cooling", "Hanon Systems", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Dvigatel issiqligini mukammal tarqatadi", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 540000, 750000, 4, 2, "dona", "R-02"),
        ("Cobalt Termostat (GM Original, 82°C)", "COOL-COB-THERM", "cooling", "GM Genuine", "Chevrolet", "Cobalt 1.5", "2013-2024", "Optimal 82 gradusda ochiladi", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 135000, 195000, 6, 2, "dona", "R-03"),
        ("Spark Suv Pompa (GMB Korea)", "COOL-SPK-PUMP", "cooling", "GMB", "Chevrolet", "Spark 1.25", "2010-2022", "Koreys metall krilchatkali nasos", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 185000, 270000, 8, 3, "dona", "R-04"),
        ("Tracker 2 Turbina Interkuler Radiatori", "COOL-TRK2-IC", "cooling", "GM Genuine", "Chevrolet", "Tracker 2 Turbo", "2021-2024", "Havo sovutuvchi interkuler", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 820000, 1150000, 2, 1, "dona", "R-05"),
        ("Malibu 2 Konditsioner Radiatori", "COOL-MAL2-AC", "cooling", "Hanon Systems", "Chevrolet", "Malibu 2", "2017-2023", "Freon sovutuvchi yupqa alyumin radiator", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 750000, 1050000, 3, 1, "dona", "R-06"),
        ("Gentra Kengayish Idishi (Rasshiritelniy Bachok)", "COOL-GEN-TNK", "cooling", "UzAuto Parts", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Qalin bosimga chidamli plastik idish", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 85000, 135000, 10, 3, "dona", "R-07"),
        ("Felix Pro Fluo Qizil Antifriz G12+ (5L)", "COOL-FLX-G12-5L", "cooling", "Felix", "Universal", "Barcha avtomobillar", "2010-2024", "-40°C gacha qotmaydigan karboksilat antifriz", "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600", "NEW", 95000, 140000, 25, 5, "dona", "R-08"),

        # --- FILTRLAR & MOYLAR (10) ---
        ("Tracker 2 Havo Filtri (GM Original)", "FLT-TRK2-AIR", "filters", "GM Genuine", "Chevrolet", "Tracker 2, Onix", "2020-2024", "1.0 / 1.2 Turbo dvigatellar uchun", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 75000, 120000, 25, 5, "dona", "F-01"),
        ("Tracker 2 Moy Filtri (GM Original)", "FLT-TRK2-OIL", "filters", "GM Genuine", "Chevrolet", "Tracker 2, Onix", "2021-2024", "Klapanli turbo motor himoyasi", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 55000, 85000, 30, 6, "dona", "F-02"),
        ("Motul 8100 X-cess Gen2 5W-40 Motor Moyi (4L)", "OIL-MOT-5W40-4L", "filters", "Motul", "Universal", "Malibu, Tracker, Cobalt, Gentra", "2010-2024", "100% sintetik frantsuz motor moyi", "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600", "NEW", 480000, 620000, 18, 5, "dona", "F-03"),
        ("Malibu 2 Salon Filtri (Uglevoy, Mahle)", "FLT-MAL2-CABIN", "filters", "Mahle", "Chevrolet", "Malibu 2", "2017-2023", "Ko'mir qatlamli toza havo filtri", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 90000, 140000, 16, 3, "dona", "F-04"),
        ("Cobalt Moy Filtri (Mann-Filter W68/3)", "FLT-COB-MANN", "filters", "Mann-Filter", "Chevrolet", "Cobalt, Spark", "2013-2024", "Germaniya sifatidagi nozik filtratsiya", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 48000, 75000, 28, 6, "dona", "F-05"),
        ("Gentra Havo Filtri (Bosch)", "FLT-GEN-AIR", "filters", "Bosch", "Chevrolet", "Gentra, Lacetti", "2008-2024", "Yuqori o'tkazuvchan toza filtr", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 45000, 70000, 22, 5, "dona", "F-06"),
        ("Castrol EDGE 5W-30 LL Motor Moyi (4L)", "OIL-CST-5W30-4L", "filters", "Castrol", "Universal", "Malibu 2, Tracker 2, Cobalt", "2015-2024", "Titanium FST texnologiyali to'liq sintetik", "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600", "NEW", 510000, 660000, 12, 4, "dona", "F-07"),
        ("Damas Moy Filtri (Original UzAuto)", "FLT-DAM-OIL", "filters", "UzAuto Parts", "Chevrolet", "Damas, Labo", "1996-2024", "Zavod moy tozalagichi", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 28000, 45000, 40, 8, "dona", "F-08"),
        ("Cobalt Benzin Filtri (Magistral osti)", "FLT-COB-FUEL", "filters", "UzAuto Parts", "Chevrolet", "Cobalt, Nexia 3", "2013-2024", "Metall korpusli yoqilg'i filtri", "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600", "NEW", 38000, 60000, 20, 5, "dona", "F-09"),
        ("Liqui Moly Top Tec 4200 5W-30 (5L)", "OIL-LM-5W30-5L", "filters", "Liqui Moly", "Universal", "Malibu 2, Onix, Tracker 2", "2017-2024", "Nemis premium motor moyi", "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600", "NEW", 680000, 890000, 8, 2, "dona", "F-10"),

        # --- TRANSMISSIYA (10) ---
        ("Cobalt Ssepleniye Disk va Korzina (Valeo Korea)", "TRN-COB-VALEO", "transmission", "Valeo", "Chevrolet", "Cobalt Mexanika", "2013-2024", "Yumshoq bosiluvchi original komplekt", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 680000, 920000, 5, 2, "to'plam", "U-01"),
        ("Gentra Vжимnoy Podshipnik (Gidravlik)", "TRN-GEN-CSC", "transmission", "Valeo", "Chevrolet", "Gentra, Lacetti", "2013-2024", "Gidravlik silindrli vijimnoy", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 280000, 410000, 7, 2, "dona", "U-02"),
        ("Cobalt Tashqi Granata (SHRUS, CTR)", "TRN-COB-CV-OUT", "transmission", "CTR", "Chevrolet", "Cobalt ABS", "2013-2024", "Pylnik va moyi bilan komplekt", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 220000, 320000, 9, 3, "to'plam", "U-03"),
        ("Nexia 3 Ichki Granata (SHRUS, Triploid)", "TRN-NEX3-CV-IN", "transmission", "UzAuto Parts", "Chevrolet", "Nexia 3 Avtomat", "2016-2023", "Kopir naychali ichki granata", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 240000, 350000, 6, 2, "to'plam", "U-04"),
        ("Malibu 2 Avtomat Korobka Moyi Dexron VI (4L)", "OIL-DEX6-4L", "transmission", "ACDelco", "Chevrolet", "Malibu 2, Tracker 2", "2017-2024", "Original ATF sintetik korobka moyi", "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600", "NEW", 380000, 520000, 10, 3, "dona", "U-05"),
        ("Spark Ssepleniye Trosi (Zavod)", "TRN-SPK-CBL", "transmission", "UzAuto Parts", "Chevrolet", "Spark Mexanika", "2010-2022", "Mustahkam trosik", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 65000, 105000, 12, 3, "dona", "U-06"),
        ("Damas Kardanchik Krestovina", "TRN-DAM-CRSS", "transmission", "GMB Korea", "Chevrolet", "Damas, Labo", "1996-2024", "Kardan mili krestovinasi", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 55000, 85000, 18, 4, "dona", "U-07"),
        ("Cobalt Korobka Kulisa Tyagasi", "TRN-COB-KUL", "transmission", "UzAuto Parts", "Chevrolet", "Cobalt", "2013-2024", "Tezlikni aniq ulovchi richag", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 120000, 180000, 7, 2, "dona", "U-08"),
        ("Gentra Ssepleniye Bosh Silindri", "TRN-GEN-CYL", "transmission", "Brembo", "Chevrolet", "Gentra", "2013-2024", "Pedal osti gidrotsilindr", "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=600", "NEW", 145000, 215000, 6, 2, "dona", "U-09"),
        ("Tracker 2 Orqa Reduktor Moyi 75W-90 (1L)", "OIL-75W90-1L", "transmission", "Motul", "Chevrolet", "Tracker 2 AWD", "2021-2024", "Differensial to'liq sintetik moyi", "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=600", "NEW", 140000, 195000, 8, 2, "dona", "U-10")
    ]

    # Dynamically expand up to 105 products with realistic variations
    results = []
    for item in raw_products:
        results.append({
            "name": item[0], "sku": item[1], "category_slug": item[2],
            "brand": item[3], "car_brand": item[4], "car_model": item[5],
            "compatible_years": item[6], "description": item[7],
            "image_url": item[8], "condition": item[9],
            "purchase_price": item[10], "selling_price": item[11],
            "quantity": item[12], "min_stock": item[13],
            "unit": item[14], "shelf_location": item[15]
        })

    # Add remaining variants to reach 105
    models_pool = [
        ("Cobalt", "Chevrolet", 2015),
        ("Gentra", "Chevrolet", 2016),
        ("Nexia 3", "Chevrolet", 2017),
        ("Tracker 2", "Chevrolet", 2022),
        ("Malibu 2", "Chevrolet", 2019),
        ("Onix", "Chevrolet", 2023),
        ("Spark", "Chevrolet", 2018),
        ("Damas", "Chevrolet", 2020)
    ]
    parts_pool = [
        ("Eshik Tutqichi Tashqi (Qora)", "body-parts", "GM Genuine", 85000, 130000, "K-14", 8),
        ("Eshik Oynasi Ko'targich Motori (Steklopod'yomnik)", "electrical", "Delphi", 195000, 290000, "E-11", 5),
        ("Salinblok Oldi Richag Katta", "suspension", "CTR Korea", 45000, 75000, "X-12", 20),
        ("Salinblok Oldi Richag Kichik", "suspension", "CTR Korea", 35000, 60000, "X-12", 22),
        ("Suv Patrubkasi Yuqori", "cooling", "UzAuto Parts", 38000, 65000, "R-09", 12),
        ("Suv Patrubkasi Pastki", "cooling", "UzAuto Parts", 42000, 70000, "R-09", 10),
        ("Termostat Korpus Qopqog'i", "cooling", "GM Genuine", 75000, 115000, "R-10", 6),
        ("Oyna Tozalagich Cho'tkalari (Dvoritsel To'plam)", "accessories", "Bosch Aerotwin", 110000, 165000, "A-01", 15)
    ]

    counter = 1
    while len(results) < 105:
        p_info = parts_pool[(counter - 1) % len(parts_pool)]
        m_info = models_pool[(counter - 1) % len(models_pool)]
        p_name = f"{m_info[0]} {p_info[0]} #{counter}"
        sku = f"{p_info[1][:3].upper()}-{m_info[0][:3].upper()}-{counter:03d}"
        
        # Determine realistic quantity (some low stock or 0)
        qty = p_info[6] if counter % 5 != 0 else (1 if counter % 10 == 0 else 0)
        
        results.append({
            "name": p_name,
            "sku": sku,
            "category_slug": p_info[1],
            "brand": p_info[2],
            "car_brand": m_info[1],
            "car_model": m_info[0],
            "compatible_years": f"{m_info[2]}-2024",
            "description": f"{m_info[0]} uchun yuqori sifatli original standartdagi ehtiyot qism.",
            "image_url": "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600",
            "condition": "NEW",
            "purchase_price": p_info[3],
            "selling_price": p_info[4],
            "quantity": qty,
            "min_stock": 2,
            "unit": "dona",
            "shelf_location": p_info[5]
        })
        counter += 1

    return results

async def seed_initial_data_if_empty():
    """Ombor bo'sh bo'lsa 105+ tovarlar va dastlabki tranzaksiyalarni to'liq yuklash."""
    count = await db.fetchval("SELECT COUNT(*) FROM products")
    if count and count >= 100:
        return

    print(f"[SEED] 100+ avto ehtiyot qismlar va tranzaksiyalar bazaga yuklanmoqda (Hozirgi: {count or 0})...")

    # Categories
    cat_map = {}
    for cat in CATEGORIES:
        existing_id = await db.fetchval("SELECT id FROM categories WHERE slug = $1", cat["slug"])
        if not existing_id:
            cid = await db.execute("""
                INSERT INTO categories (name, slug, icon, description, sort_order)
                VALUES ($1, $2, $3, $4, $5)
            """, cat["name"], cat["slug"], cat["icon"], cat["description"], cat["sort_order"])
            if not cid or isinstance(cid, str):
                cid = await db.fetchval("SELECT id FROM categories WHERE slug = $1", cat["slug"])
            cat_map[cat["slug"]] = cid
        else:
            cat_map[cat["slug"]] = existing_id

    # Ensure HEAD ADMIN exists in admins table
    if HEAD_ADMIN_ID:
        ha_exists = await db.fetchrow("SELECT * FROM admins WHERE role = 'HEAD_ADMIN'")
        if not ha_exists:
            await db.execute("""
                INSERT INTO admins (telegram_id, username, first_name, role, status, created_by)
                VALUES ($1, 'bosh_admin', 'Bosh Admin', 'HEAD_ADMIN', 'ACTIVE', 0)
            """, HEAD_ADMIN_ID)

    all_products = get_105_products()

    # Insert products
    for p in all_products:
        exists = await db.fetchval("SELECT id FROM products WHERE sku = $1", p["sku"])
        if exists:
            continue

        cid = cat_map.get(p["category_slug"], 1)
        await db.execute("""
            INSERT INTO products (
                name, sku, category_id, brand, car_brand, car_model, compatible_years,
                description, image_url, condition, purchase_price, selling_price,
                quantity, min_stock, unit, shelf_location, is_active, is_deleted
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, 0)
        """,
            p["name"], p["sku"], cid, p["brand"], p["car_brand"], p["car_model"],
            p["compatible_years"], p["description"], p["image_url"], p["condition"],
            p["purchase_price"], p["selling_price"], p["quantity"], p["min_stock"],
            p["unit"], p["shelf_location"]
        )

    # Initial budget & realistic transactions if transactions table empty
    tx_count = await db.fetchval("SELECT COUNT(*) FROM transactions")
    if not tx_count or tx_count == 0:
        running_balance = INITIAL_BUDGET

        # Initial budget transaction
        await db.execute("""
            INSERT INTO transactions (
                tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                admin_id, admin_name, customer_or_supplier, reason, note
            ) VALUES (
                'TX-10001', NULL, 'Kassa Ochilishi (Dastlabki Byudjet)', 'tuzatish', 1, $1, 0,
                $1, 0, 0, 0, 0, $1,
                $2, 'Bosh Admin', 'Ta''sischi', 'Kassa ochilishi', 'Ombor dastlabki aylanma mablag''i'
            )
        """, INITIAL_BUDGET, HEAD_ADMIN_ID or 0)

        tx_init_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = 'TX-10001'")
        await db.execute("""
            INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
            VALUES ($1, 'DEBIT', $2, $2, 'Kassa boshlang''ich balansi kiritildi')
        """, tx_init_id, INITIAL_BUDGET)

        # Sample purchase (Stock in)
        p1 = await db.fetchrow("SELECT * FROM products WHERE sku = 'TIRE-MICH-2055516'")
        if p1:
            cost = 4 * p1["purchase_price"]
            prev_bal = running_balance
            running_balance -= cost
            await db.execute("""
                INSERT INTO transactions (
                    tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                    total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                    admin_id, admin_name, customer_or_supplier, reason, note
                ) VALUES (
                    'TX-10002', $1, $2, 'kirim', 4, $3, $3, $4, 0, $5, $6, $7, $8,
                    $9, 'Bosh Admin', 'Michelin Central Asia', 'Xarid', 'Yangi partiya qabul qilindi'
                )
            """, p1["id"], p1["name"], p1["purchase_price"], cost, p1["quantity"] - 4, p1["quantity"],
                prev_bal, running_balance, HEAD_ADMIN_ID or 0)

            tx2_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = 'TX-10002'")
            await db.execute("""
                INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
                VALUES ($1, 'CREDIT', $2, $3, 'Michelin shinalar xaridi')
            """, tx2_id, cost, running_balance)

        # Sample sale (Stock out)
        if p1:
            rev = 2 * p1["selling_price"]
            c = 2 * p1["purchase_price"]
            prof = rev - c
            prev_bal = running_balance
            running_balance += rev
            await db.execute("""
                INSERT INTO transactions (
                    tx_number, product_id, product_name, type, quantity, unit_price, cost_price,
                    total_amount, profit, prev_stock, new_stock, prev_balance, new_balance,
                    admin_id, admin_name, customer_or_supplier, reason, note
                ) VALUES (
                    'TX-10003', $1, $2, 'chiqim', 2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, 'Bosh Admin', 'Mijoz: Shavkat aka (Gentra)', 'Sotuv', 'Naqd to''lov'
                )
            """, p1["id"], p1["name"], p1["selling_price"], p1["purchase_price"], rev, prof,
                p1["quantity"] + 2, p1["quantity"], prev_bal, running_balance, HEAD_ADMIN_ID or 0)

            tx3_id = await db.fetchval("SELECT id FROM transactions WHERE tx_number = 'TX-10003'")
            await db.execute("""
                INSERT INTO cash_ledger (transaction_id, entry_type, amount, balance_after, description)
                VALUES ($1, 'DEBIT', $2, $3, 'Michelin shina sotuv tushumi')
            """, tx3_id, rev, running_balance)

    total_prods = await db.fetchval("SELECT COUNT(*) FROM products WHERE is_deleted = 0")
    print(f"[SEED] Tayyor! Omborda jami {total_prods} ta ehtiyot qismlar mavjud.")
