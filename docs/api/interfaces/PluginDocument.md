[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PluginDocument

# Interface: PluginDocument

Defined in: [src/plugins/pluginSystem.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L31)

Minimal document shape visible to plugins.

## Methods

### getPageCount()

> **getPageCount**(): `number`

Defined in: [src/plugins/pluginSystem.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L32)

#### Returns

`number`

***

### getPages()

> **getPages**(): readonly [`PluginPage`](PluginPage.md)[]

Defined in: [src/plugins/pluginSystem.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L33)

#### Returns

readonly [`PluginPage`](PluginPage.md)[]

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/plugins/pluginSystem.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L35)

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setCreationDate()

> **setCreationDate**(`date`): `void`

Defined in: [src/plugins/pluginSystem.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L40)

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setCreator()

> **setCreator**(`creator`): `void`

Defined in: [src/plugins/pluginSystem.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L39)

#### Parameters

##### creator

`string`

#### Returns

`void`

***

### setKeywords()

> **setKeywords**(`keywords`): `void`

Defined in: [src/plugins/pluginSystem.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L37)

#### Parameters

##### keywords

`string` \| `string`[]

#### Returns

`void`

***

### setLanguage()

> **setLanguage**(`lang`): `void`

Defined in: [src/plugins/pluginSystem.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L42)

#### Parameters

##### lang

`string`

#### Returns

`void`

***

### setModDate()

> **setModDate**(`date`): `void`

Defined in: [src/plugins/pluginSystem.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L41)

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setProducer()

> **setProducer**(`producer`): `void`

Defined in: [src/plugins/pluginSystem.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L38)

#### Parameters

##### producer

`string`

#### Returns

`void`

***

### setSubject()

> **setSubject**(`subject`): `void`

Defined in: [src/plugins/pluginSystem.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L36)

#### Parameters

##### subject

`string`

#### Returns

`void`

***

### setTitle()

> **setTitle**(`title`): `void`

Defined in: [src/plugins/pluginSystem.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/pluginSystem.ts#L34)

#### Parameters

##### title

`string`

#### Returns

`void`
