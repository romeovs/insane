export const arabic = {
	code: "ar",
	regconfig: "arabic",
	name: "Arabic",
	graphql: "AR",
} as const

export const armenian = {
	code: "hy",
	regconfig: "armenian",
	name: "Armenian",
	graphql: "HY",
} as const

export const basque = {
	code: "eu",
	regconfig: "basque",
	name: "Basque",
	graphql: "EU",
} as const

export const catalan = {
	code: "ca",
	regconfig: "catalan",
	name: "Catalan",
	graphql: "CA",
} as const

export const danish = {
	code: "da",
	regconfig: "danish",
	name: "Danish",
	graphql: "DA",
} as const

export const dutch = {
	code: "nl",
	regconfig: "dutch",
	name: "Dutch",
	graphql: "NL",
} as const

export const english = {
	code: "en",
	regconfig: "english",
	name: "English",
	graphql: "EN",
} as const

export const finnish = {
	code: "fi",
	regconfig: "finnish",
	name: "Finnish",
	graphql: "FI",
} as const

export const french = {
	code: "fr",
	regconfig: "french",
	name: "French",
	graphql: "FR",
} as const

export const german = {
	code: "de",
	regconfig: "german",
	name: "German",
	graphql: "DE",
} as const

export const greek = {
	code: "el",
	regconfig: "greek",
	name: "Greek",
	graphql: "EL",
} as const

export const hindi = {
	code: "hi",
	regconfig: "hindi",
	name: "Hindi",
	graphql: "HI",
} as const

export const hungarian = {
	code: "hu",
	regconfig: "hungarian",
	name: "Hungarian",
	graphql: "HU",
} as const

export const indonesian = {
	code: "in",
	regconfig: "indonesian",
	name: "Indonesian",
	graphql: "IN",
} as const

export const irish = {
	code: "ga",
	regconfig: "irish",
	name: "Irish",
	graphql: "GA",
} as const

export const italian = {
	code: "it",
	regconfig: "italian",
	name: "Italian",
	graphql: "IT",
} as const

export const lithuanian = {
	code: "lt",
	regconfig: "lithuanian",
	name: "Lithuanian",
	graphql: "LT",
} as const

export const nepali = {
	code: "ne",
	regconfig: "nepali",
	name: "Nepali",
	graphql: "NE",
} as const

export const norwegian = {
	code: "no",
	regconfig: "norwegian",
	name: "Norwegian",
	graphql: "NO",
} as const

export const portuguese = {
	code: "pt",
	regconfig: "portuguese",
	name: "Portuguese",
	graphql: "PT",
} as const

export const romanian = {
	code: "ro",
	regconfig: "romanian",
	name: "Romanian",
	graphql: "RO",
} as const

export const russian = {
	code: "ru",
	regconfig: "russian",
	name: "Russian",
	graphql: "RU",
} as const

export const serbian = {
	code: "sr",
	regconfig: "serbian",
	name: "Serbian",
	graphql: "SR",
} as const

export const spanish = {
	code: "es",
	regconfig: "spanish",
	name: "Spanish",
	graphql: "ES",
} as const

export const swedish = {
	code: "sv",
	regconfig: "swedish",
	name: "Swedish",
	graphql: "SV",
} as const

export const tamil = {
	code: "ta",
	regconfig: "tamil",
	name: "Tamil",
	graphql: "TA",
} as const

export const turkish = {
	code: "tr",
	regconfig: "turkish",
	name: "Turkish",
	graphql: "TR",
} as const

export const yiddish = {
	code: "yi",
	regconfig: "yiddish",
	name: "Yiddish",
	graphql: "YI",
} as const

export const languages = [
	arabic,
	armenian,
	basque,
	catalan,
	danish,
	dutch,
	english,
	finnish,
	french,
	german,
	greek,
	hindi,
	hungarian,
	indonesian,
	irish,
	italian,
	lithuanian,
	nepali,
	norwegian,
	portuguese,
	romanian,
	russian,
	serbian,
	spanish,
	swedish,
	tamil,
	turkish,
	yiddish,
] as const

export type Language = (typeof languages)[number]
export type LanguageCode = Language["code"]
export type LanguageTag = Language["graphql"]

export function fromGraphQL(tag: string | null): Language | null {
	const language = languages.find((lang) => lang.graphql === tag)
	if (!language) {
		throw new Error(`Unsupported language ${tag}`)
	}
	return language
}
