[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ChangeTracker

# Class: ChangeTracker

Defined in: [src/core/incrementalWriter.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L61)

Tracks which objects have been added or modified since the document
was loaded. Only these objects are written during an incremental save.

## Constructors

### Constructor

> **new ChangeTracker**(`originalMaxObjNum`): `ChangeTracker`

Defined in: [src/core/incrementalWriter.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L71)

#### Parameters

##### originalMaxObjNum

`number`

#### Returns

`ChangeTracker`

## Accessors

### changedCount

#### Get Signature

> **get** **changedCount**(): `number`

Defined in: [src/core/incrementalWriter.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L110)

Get the count of changed objects.

##### Returns

`number`

## Methods

### getChangedObjects()

> **getChangedObjects**(): `Set`\<`number`\>

Defined in: [src/core/incrementalWriter.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L103)

Get all changed object numbers (new + modified).

#### Returns

`Set`\<`number`\>

***

### isChanged()

> **isChanged**(`objectNumber`): `boolean`

Defined in: [src/core/incrementalWriter.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L96)

Check if an object is new or modified.

#### Parameters

##### objectNumber

`number`

#### Returns

`boolean`

***

### markModified()

> **markModified**(`objectNumber`): `void`

Defined in: [src/core/incrementalWriter.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L85)

Mark an object as modified (existed in the original file).

#### Parameters

##### objectNumber

`number`

#### Returns

`void`

***

### markNew()

> **markNew**(`objectNumber`): `void`

Defined in: [src/core/incrementalWriter.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/incrementalWriter.ts#L78)

Mark an object as new (did not exist in the original file).

#### Parameters

##### objectNumber

`number`

#### Returns

`void`
