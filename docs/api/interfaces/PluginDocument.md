[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PluginDocument

# Interface: PluginDocument

Defined in: [src/plugins/pluginSystem.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L31)

Minimal document shape visible to plugins.

## Methods

### getPageCount()

```ts
getPageCount(): number;
```

Defined in: [src/plugins/pluginSystem.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L32)

#### Returns

`number`

***

### getPages()

```ts
getPages(): readonly PluginPage[];
```

Defined in: [src/plugins/pluginSystem.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L33)

#### Returns

readonly [`PluginPage`](PluginPage.md)[]

***

### setAuthor()

```ts
setAuthor(author): void;
```

Defined in: [src/plugins/pluginSystem.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L35)

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setCreationDate()

```ts
setCreationDate(date): void;
```

Defined in: [src/plugins/pluginSystem.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L40)

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setCreator()

```ts
setCreator(creator): void;
```

Defined in: [src/plugins/pluginSystem.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L39)

#### Parameters

##### creator

`string`

#### Returns

`void`

***

### setKeywords()

```ts
setKeywords(keywords): void;
```

Defined in: [src/plugins/pluginSystem.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L37)

#### Parameters

##### keywords

`string` \| `string`[]

#### Returns

`void`

***

### setLanguage()

```ts
setLanguage(lang): void;
```

Defined in: [src/plugins/pluginSystem.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L42)

#### Parameters

##### lang

`string`

#### Returns

`void`

***

### setModDate()

```ts
setModDate(date): void;
```

Defined in: [src/plugins/pluginSystem.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L41)

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setProducer()

```ts
setProducer(producer): void;
```

Defined in: [src/plugins/pluginSystem.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L38)

#### Parameters

##### producer

`string`

#### Returns

`void`

***

### setSubject()

```ts
setSubject(subject): void;
```

Defined in: [src/plugins/pluginSystem.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L36)

#### Parameters

##### subject

`string`

#### Returns

`void`

***

### setTitle()

```ts
setTitle(title): void;
```

Defined in: [src/plugins/pluginSystem.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L34)

#### Parameters

##### title

`string`

#### Returns

`void`
