[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ChangeTracker

# Class: ChangeTracker

Defined in: [src/core/incrementalWriter.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L57)

Tracks which objects have been added or modified since the document
was loaded. Only these objects are written during an incremental save.

## Constructors

### Constructor

> **new ChangeTracker**(`originalMaxObjNum`): `ChangeTracker`

Defined in: [src/core/incrementalWriter.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L67)

#### Parameters

##### originalMaxObjNum

`number`

#### Returns

`ChangeTracker`

## Accessors

### changedCount

#### Get Signature

> **get** **changedCount**(): `number`

Defined in: [src/core/incrementalWriter.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L106)

Get the count of changed objects.

##### Returns

`number`

## Methods

### getChangedObjects()

> **getChangedObjects**(): `Set`\<`number`\>

Defined in: [src/core/incrementalWriter.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L99)

Get all changed object numbers (new + modified).

#### Returns

`Set`\<`number`\>

***

### isChanged()

> **isChanged**(`objectNumber`): `boolean`

Defined in: [src/core/incrementalWriter.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L92)

Check if an object is new or modified.

#### Parameters

##### objectNumber

`number`

#### Returns

`boolean`

***

### markModified()

> **markModified**(`objectNumber`): `void`

Defined in: [src/core/incrementalWriter.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L81)

Mark an object as modified (existed in the original file).

#### Parameters

##### objectNumber

`number`

#### Returns

`void`

***

### markNew()

> **markNew**(`objectNumber`): `void`

Defined in: [src/core/incrementalWriter.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L74)

Mark an object as new (did not exist in the original file).

#### Parameters

##### objectNumber

`number`

#### Returns

`void`
