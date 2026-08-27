# Chinese Running-Shoe Research — Saturation Pass (2026-08-26)

## Scope and stopping rule

This ledger records the final saturation pass for the Hermes shoe catalog. The search scope was public Chinese shopping and brand surfaces, with emphasis on running, track, marathon, training, trail, and school fitness-test footwear. A candidate was admitted only when public evidence identified a stable brand/product family and the family could be normalized without retaining a generation, colorway, marketing adjective, or isolated SKU.

The pass stops when fresh searches return repeats of covered families, generation/color variants, generic marketplace products, or marketplace-only names without a stable family boundary. It does not claim that every shoe sold in China has been indexed.

## Catalog gate

- Keep one canonical family name per brand; collapse `1.0`, `2.0`, `Pro`, `Ultra`, year, color, and similar release suffixes when they are generations or variants of the same family.
- Keep a numeric name only when the public evidence presents it as the stable family identifier (for example, `008`, `1906`, `699`, or `181S`).
- Include running/track/fitness-test/trail families; exclude lifestyle shoes, generic factory listings, accessories, and one-off marketplace SKUs.
- Compare against the existing catalog case-insensitively before adding a brand/family.

## Brand-logo handling

- `ShoeBrandLogo` keeps the existing precedence: an explicit backend `logoUrl` or a bundled local image asset wins.
- Newly researched brands without a verified downloadable logo asset now resolve to a deterministic brand-specific text mark in the shared logo resolver, so they render as branded marks rather than raw emoji. These marks are UI fallbacks and are not presented as official trademark artwork.
- Logo/identity checks used the official or public brand surfaces already recorded in this ledger, including the [海尔斯 product brochure](https://static.11yd.com/upload/202506/03/16/2025%E6%B5%B7%E5%B0%94%E6%96%AF%E6%B1%87%E6%80%BB%E4%BA%A7%E5%93%81%E5%9B%BE%E5%86%8C.pdf), [音速猫 official site](https://www.soniccat.cn/cases/), [天赐之翼 official JD store](https://mall.jd.com/index-829429.html?cu=true), and [R2 official brand site](https://r2.cloudsview.cn/). Product photography and third-party image-search results were not mislabeled as official logo assets.

## Families accepted in this saturation pass

### Existing brands

- **多威 / Do-win:** `征驰`, `致远`, `启程`, `上道`, `全地形`.
- **德尔惠 / Deerway:** `裂空`.
- **赛琪 / Saiqi:** `追风`.
- **金莱克 / Jinlaike:** `芷境`.

### Newly represented brands

- **双星八特:** `新体考`.
- **轻跑者 / LIGHTSPEEDER:** `锋刃`, `影刃`, `青羽`.
- **喜得龙 / XDLONG:** `逐风`, `龙影`, `龙雀`, `游龙`.
- **R2 REALRUN:** `LSD`, `无极`, `信念`, `悠跑`, `风跑`, `电跑`, `云跑`, `云跑碳术`.

`轻跑者 / 青羽` was added only after a separate current JD product-family result surfaced it alongside the already verified `锋刃` and `影刃` lines. `R2 / 云跑` and `R2 / 电跑` were admitted after the current R2 brand site exposed them in its product-series and event/product navigation; `LSD` is retained as the normalized family name for the official `LSD赤道` timeline entry.

## Evidence ledger

### Round group A — specialist track and fitness-test brands

1. **多威 official current store:** the official Youzan storefront exposes `征驰1代`, `启程`, `上道`, and `全地形` among current products; the separate `致远` listing is a named track/fitness-test family. Versions, PB codes, and colorways were collapsed or skipped. Source: <https://detail.youzan.com/show/goods/newest?kdt_id=42390240>.
2. **多威 product detail:** the official store has a current `征驰1代` product with stock, confirming that the family is not just an old search snippet. Source: <https://detail.youzan.com/show/goods?alias=3f1psj0ypyu9c9q&from_source=gbox_seo>.
3. **德尔惠:** current JD brand results identify `裂空1.0` as a carbon racing/training shoe; normalized to `裂空`. The official JD flagship separately confirms the brand storefront. Sources: <https://www.jd.com/brand/1318ed908bebc220edfe.html> and <https://mall.jd.com/index-16667001.html>.
4. **赛琪:** the official site identifies the footwear company and current JD results expose `追风2` and related running products; normalized to `追风`. The generic `极地幻影-N5` listing was not treated as a stable family without clearer naming evidence. Sources: <https://www.saiqi.com/> and <https://www.jd.com/hprm/131841e20ddebcbb512c.html>.
5. **金莱克:** current JD brand results expose `芷境3`, `心跳`, and `P2`; `芷境` was admitted as the named cushioning family, while `心跳` and `P2` were not added without stronger running-family evidence. Source: <https://www.jd.com/brand/13188b9237f8d888f165.html>.
6. **双星八特:** current JD results expose a separate `双星八特` brand and its `新体考鞋` line. This was kept separate from `双星 / 新田径`. Sources: <https://www.jd.com/hprm/1172946e20c319312f118.html> and <https://www.jd.com/brand/1318805f24d81c6118e5.html>.
7. **轻跑者 / LIGHTSPEEDER:** the current JD brand result names the brand, a community product page identifies `锋刃2.0` and `锋刃1.0`, and a current JD result exposes `影刃`; the families were normalized to `锋刃` and `影刃`. Sources: <https://www.jd.com/brand/131873d2118fbd6cfd01.html>, <https://m.shihuo.cn/page/findCommunityDetail?id=5547064>, and <https://www.jd.com/jiage/131886f90538b764045a.html>.
8. **轻跑者 / 青羽:** the latest current JD brand/product result separately surfaces `青羽` as a full-carbon family. It was added after this additional evidence, not inferred from the earlier `锋刃` result. Source: <https://www.jd.com/jiage/131886f90538b764045a.html>.
9. **喜得龙 / XDLONG:** current JD results expose `逐风1.0`, `龙影1.0pro`, `龙雀1.0`, and `游龙1.0`; normalized to four families. Independent brand/store references confirm the running-shoe category and company identity. Sources: <https://www.jd.com/brand/117291ff8a45303a32bdf.html>, <https://www.gouwuyi.com/43502.html>, and <https://www.maigoo.com/brand/3988.html>.

### Round group B — R2 REALRUN official-site verification

10. **R2 company/about timeline:** the official company page describes R2 as a Chinese professional high-performance running brand and names `LSD赤道`, `WUJI无极`, `FAITH信念`, `YOURUN悠跑`, and `WINDRUN风跑`. Source: <https://www.r2realrun.com/aboutR2/cplc.html>.
11. **R2 current brand site:** the current R2 site exposes `风跑`, `云跑碳术`, `云跑`, `悠跑`, `无极`, `信念`, `赤道`, and the current event/product navigation includes `电跑Lightning1.0`. `LSD赤道` was not duplicated as a second family; `云跑EASY` was treated as a variant. Source: <https://r2.cloudsview.cn/>.
12. **R2 official storefront:** the current official Youzan surface describes R2 as a professional cushioning running brand and lists `云跑`, supporting the family admission. Source: <https://detail.youzan.com/show/goods/newest?kdt_id=19299001>.

### Round group C — final broad marketplace sweeps

13. **JD domestic-running brand aggregation:** the current category repeats 多威, 特步, 安踏, 乔丹, and other brands already covered; no new stable family survived the catalog gate. Source: <https://www.jd.com/brand/1318af25023e623c487c.html>.
14. **JD 4.0 running aggregation:** results repeat 弹射者 `黑马`, 361 `飞燃`, and existing mainstream families; numbered generations were not new families. Source: <https://www.jd.com/brand/131809e5e5b36eead54a.html>.
15. **JD professional-running aggregation:** results repeat 弹射者, 多威, 特步, 李宁, 安踏, and other catalog-covered lines; no independent new family cleared the identity gate. Source: <https://www.jd.com/brand/13180fd81f91fb4d1c16.html>.
16. **JD track-training category:** results are dominated by 多威征途 and other already-covered brands, plus generic youth/children products without stable family identity. Source: <https://www.jd.com/hprm/1318c8e60e3cc5509f14.html>.
17. **JD broad brand listing:** additional marketplace-only hits such as KUNY, 疾步/JIBU, LNKB, 兀跑/VIPAO, Seafung, and SHMK SUPREME were inspected. They lacked a sufficiently clear independent current family boundary, so they remain excluded. Source: <https://www.jd.com/brand/1318e13670be472bc96b.html>.
18. **SHMK SUPREME follow-up:** current results expose generic-looking carbon/track product codes such as `SS1007` and `SS881`, but no stable series taxonomy or authoritative brand/product-family boundary. Source: <https://www.jd.com/brand/1318e13670be472bc96b.html>.
19. **Final current JD search:** fresh results repeat 弹射者、海尔斯、多威、特步、轻跑者、R2 and other covered brands. Remaining hits are generations, color names, generic listings, or previously rejected weak candidates. Source: <https://www.jd.com/brand/1318af25023e623c487c.html>.

## Earlier continuation discoveries retained in the catalog

The same pass also verified and added the following earlier batch before this final saturation group: 海尔斯 (`KM3`, `KM2`, `KM3C+`, `强径`, `强训`, `KMR`, `飞翼`, `CPX`, `CP5`, `CP2`, `181S`, `818S`, `699`, `1200`, `6000`); 辛逸 (`730`, `737`, `733`, `1019`, `108`); 弹射者 (`黑马`, `猎豹`, `Airone`, `追风`); 威量 (`炽速`, `无畏`, `夺魁`, `骇速`, `超神`, `幻速`, `闪耀`, `大满贯`); 音速猫 (`起源`, `无双`, `觉醒`, `逆天`, `无尽`, `上瘾`, `爆发`); 星火力 (`音速`, `极速`); 领跑梦想 (`飝翼`, `闪速`, `疾锋`, `凌波`, `极韧`); 燃动力 (`竞速`, `轻燃`, `大圣`, `轻弹`, `闪电GT`); 天赐之翼 (`宙斯`, `暴风`); 双星 (`新田径`); ONEMIX (`觅氧`, `劲飞爽`, `悟爽`); FREETIE (`云弹`, `城市轻跑`, `复古80`); 派燃烧 (`状元`, `驰翼`, `赤狐`, `GTS`); 强风跑霸 (`风速`, `鲲鹏`); 申亚 (`008`, `1906`, `848`, `1808`, `2128`, `2323`); plus the existing-brand additions recorded above.

## Rejected or held after the final search

- `SHMK SUPREME`, `KUNY`, `疾步/JIBU`, `LNKB`, `科鑫/KEXIN`, `三栖虎`, `TLXT`, and `山头林村`: marketplace-only or generic products without a reliable stable family boundary.
- `际华三五三五`, `钠克宾`, and `CDAC`: generic training/industrial or isolated model-code evidence, not an independently verified running-shoe family.
- `FEINECE`, `祺动`, `卡戴金`, and similar small marketplace names: insufficient current brand/product evidence after follow-up checks.
- `回力`, `飞跃`, and `贵人鸟`: current results are predominantly lifestyle or generic running-shoe listings, not a clear canonical running-series taxonomy.
- Color names, technology names, release generations, `Pro`/`Ultra` suffixes, and one-off SKUs: excluded by normalization even when the parent family was admitted.

## Saturation conclusion

After the final broad searches across JD category/brand pages and the targeted official/brand storefronts above, no additional distinct Chinese running/track/training/trail family met all three gates: current public evidence, stable family identity, and non-duplication with the catalog. The remaining search hits were repeats, variants, generic marketplace entries, or weak names without enough evidence. The catalog is therefore stopping at this pass pending a new source, brand, or user-provided target list.
